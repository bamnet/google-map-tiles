import { afterEach, expect, mock, setSystemTime, spyOn, test } from "bun:test";
import { SessionPool, sessionKey } from "./session_pool.ts";
import type { SessionOptions } from "./tiles.ts";

const roadmap: SessionOptions = {
  mapType: "roadmap",
  language: "en-US",
  region: "US",
};

const TWO_WEEKS_S = 14 * 24 * 60 * 60;

afterEach(() => {
  mock.restore();
  setSystemTime();
});

/** Moves the clock forward. */
function advance(ms: number) {
  setSystemTime(new Date(Date.now() + ms));
}

/**
 * Replaces fetch with a fake createSession endpoint that issues numbered
 * sessions ("session-1", "session-2", ...) expiring `lifetimeS` from now.
 * The cast is needed because Bun's fetch type also requires `preconnect`.
 */
function mockSessions(lifetimeS = TWO_WEEKS_S) {
  let count = 0;
  return spyOn(globalThis, "fetch").mockImplementation((() => {
    count++;
    return Promise.resolve(
      Response.json({
        session: `session-${count}`,
        expiry: String(Math.floor(Date.now() / 1000) + lifetimeS),
        tileWidth: 256,
        tileHeight: 256,
        imageFormat: "png",
      }),
    );
  }) as unknown as typeof fetch);
}

test("SessionPool - reuses the session for the same options", async () => {
  const fetchSpy = mockSessions();
  const pool = new SessionPool("test-api-key");

  const a = await pool.client(roadmap);
  const b = await pool.client({
    region: "US",
    language: "en-US",
    mapType: "roadmap",
  });

  expect(a).toBe(b);
  expect(a.session?.session).toBe("session-1");
  expect(fetchSpy).toHaveBeenCalledTimes(1);
});

test("SessionPool - keeps separate sessions for different options", async () => {
  const fetchSpy = mockSessions();
  const pool = new SessionPool("test-api-key");

  const road = await pool.client(roadmap);
  const sat = await pool.client({ ...roadmap, mapType: "satellite" });

  expect(road).not.toBe(sat);
  expect(fetchSpy).toHaveBeenCalledTimes(2);
});

test("SessionPool - concurrent callers share one request", async () => {
  const fetchSpy = mockSessions();
  const pool = new SessionPool("test-api-key");

  const clients = await Promise.all([
    pool.client(roadmap),
    pool.client(roadmap),
    pool.client(roadmap),
  ]);

  expect(new Set(clients).size).toBe(1);
  expect(fetchSpy).toHaveBeenCalledTimes(1);
});

test("SessionPool - does not cache failures", async () => {
  spyOn(globalThis, "fetch").mockImplementation((() =>
    Promise.resolve(
      Response.json({ error: { message: "Backend error" } }, { status: 500 }),
    )) as unknown as typeof fetch);
  const pool = new SessionPool("test-api-key");

  await expect(pool.client(roadmap)).rejects.toThrow("Backend error");

  mock.restore();
  mockSessions();
  const client = await pool.client(roadmap);
  expect(client.session?.session).toBe("session-1");
});

test("SessionPool - replaces sessions that are about to expire", async () => {
  const fetchSpy = mockSessions();
  const pool = new SessionPool("test-api-key");

  const first = await pool.client(roadmap);
  advance((TWO_WEEKS_S - 2 * 60 * 60) * 1000); // 2 hours left: keep
  const second = await pool.client(roadmap);
  advance(90 * 60 * 1000); // 30 minutes left: inside the 1 hour margin
  const third = await pool.client(roadmap);

  expect(second).toBe(first);
  expect(third.session?.session).toBe("session-2");
  expect(fetchSpy).toHaveBeenCalledTimes(2);
});

test("SessionPool - never replaces a new short-lived session", async () => {
  // Sessions last 30 minutes, shorter than the 1 hour refresh margin.
  const fetchSpy = mockSessions(30 * 60);
  const pool = new SessionPool("test-api-key");

  const clients = await Promise.all([
    pool.client(roadmap),
    pool.client(roadmap),
  ]);
  advance(10 * 60 * 1000); // 20 minutes left, more than half the lifetime
  clients.push(await pool.client(roadmap));
  advance(10 * 60 * 1000); // 10 minutes left: replace
  const replaced = await pool.client(roadmap);

  expect(new Set(clients).size).toBe(1);
  expect(replaced.session?.session).toBe("session-2");
  expect(fetchSpy).toHaveBeenCalledTimes(2);
});

test("SessionPool - concurrent callers share one replacement", async () => {
  const fetchSpy = mockSessions();
  const pool = new SessionPool("test-api-key");
  await pool.client(roadmap);
  advance(TWO_WEEKS_S * 1000); // expired

  const clients = await Promise.all([
    pool.client(roadmap),
    pool.client(roadmap),
    pool.client(roadmap),
  ]);

  expect(new Set(clients).size).toBe(1);
  expect(clients[0].session?.session).toBe("session-2");
  // The initial session, then exactly one replacement.
  expect(fetchSpy).toHaveBeenCalledTimes(2);
});

test("SessionPool - clear forgets sessions", async () => {
  const fetchSpy = mockSessions();
  const pool = new SessionPool("test-api-key");

  await pool.client(roadmap);
  pool.clear();
  await pool.client(roadmap);

  expect(fetchSpy).toHaveBeenCalledTimes(2);
});

test("sessionKey - ignores property order, keeps array order", () => {
  expect(sessionKey({ ...roadmap, layerTypes: ["layerRoadmap"] })).toBe(
    sessionKey({
      layerTypes: ["layerRoadmap"],
      region: "US",
      mapType: "roadmap",
      language: "en-US",
    }),
  );
  expect(sessionKey({ ...roadmap, styles: [{ a: 1, b: 2 }] })).toBe(
    sessionKey({ ...roadmap, styles: [{ b: 2, a: 1 }] }),
  );
  expect(
    sessionKey({ ...roadmap, layerTypes: ["layerRoadmap", "layerTraffic"] }),
  ).not.toBe(
    sessionKey({ ...roadmap, layerTypes: ["layerTraffic", "layerRoadmap"] }),
  );
});
