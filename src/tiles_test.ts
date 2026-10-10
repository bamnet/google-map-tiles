import { expect, test } from "bun:test";
import { GoogleMapTiles, MapType, type SessionOptions } from "./tiles.ts";

// Mock responses
const mockSessionResponse = {
  session: "mock-session-token",
  // Seconds since the epoch, as returned by the API. Two weeks from now.
  expiry: String(Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60),
  tileWidth: 256,
  tileHeight: 256,
  imageFormat: "png",
};

const mockViewportResponse = {
  copyright: "Mock Copyright © 2025",
  maxZoomRects: [
    {
      maxZoom: 21,
      north: 41.0,
      south: 39.0,
      east: -71.0,
      west: -79.0,
    },
  ],
};

// Setup and teardown utilities
function createTestContext() {
  const originalFetch = globalThis.fetch;
  return {
    cleanup: () => {
      globalThis.fetch = originalFetch;
    },
    mockFetch: (response: unknown, ok = true) => {
      globalThis.fetch = (() =>
        Promise.resolve({
          ok,
          json: () => Promise.resolve(response),
          statusText: ok ? "OK" : "Error",
        } as Response)) as unknown as typeof fetch;
    },
  };
}

test("GoogleMapTiles - createSession", async () => {
  const ctx = createTestContext();
  ctx.mockFetch(mockSessionResponse);

  try {
    const apiKey = "test-api-key";
    const googleMapTiles = new GoogleMapTiles(apiKey);
    const sessionRequest: SessionOptions = {
      mapType: MapType.Satellite,
      language: "en-US",
      region: "us",
    };

    const session = await googleMapTiles.createSession(sessionRequest);
    expect(session).toEqual(mockSessionResponse);
  } finally {
    ctx.cleanup();
  }
});

test("GoogleMapTiles - createSession failure", async () => {
  const ctx = createTestContext();
  ctx.mockFetch(
    {
      error: {
        code: 403,
        message: "Requests from referer https://test/ are blocked.",
        errors: [
          {
            message: "Requests from referer https://test/ are blocked.",
            domain: "global",
            reason: "forbidden",
          },
        ],
      },
    },
    false,
  );

  try {
    const apiKey = "test-api-key";
    const googleMapTiles = new GoogleMapTiles(apiKey);
    const sessionRequest: SessionOptions = {
      mapType: MapType.Satellite,
      language: "en-US",
      region: "us",
    };

    await expect(googleMapTiles.createSession(sessionRequest)).rejects.toThrow(
      "Error creating session: Requests from referer https://test/ are blocked.",
    );
  } finally {
    ctx.cleanup();
  }
});

test("GoogleMapTiles - getViewport", async () => {
  const ctx = createTestContext();
  ctx.mockFetch(mockSessionResponse);

  try {
    const apiKey = "test-api-key";
    const googleMapTiles = new GoogleMapTiles(apiKey);
    const sessionRequest: SessionOptions = {
      mapType: MapType.Satellite,
      language: "en-US",
      region: "us",
    };

    await googleMapTiles.createSession(sessionRequest);

    ctx.mockFetch(mockViewportResponse);
    const viewport = await googleMapTiles.getViewport(10, 40, 30, -70, -80);
    expect(viewport).toEqual(mockViewportResponse);
  } finally {
    ctx.cleanup();
  }
});

test("GoogleMapTiles - getViewport failure", async () => {
  const ctx = createTestContext();
  ctx.mockFetch(mockSessionResponse);

  try {
    const apiKey = "test-api-key";
    const googleMapTiles = new GoogleMapTiles(apiKey);
    const sessionRequest: SessionOptions = {
      mapType: MapType.Satellite,
      language: "en-US",
      region: "us",
    };

    await googleMapTiles.createSession(sessionRequest);

    ctx.mockFetch({}, false);
    await expect(
      googleMapTiles.getViewport(10, 40, 30, -70, -80),
    ).rejects.toThrow("Error fetching viewport");
  } finally {
    ctx.cleanup();
  }
});

test("GoogleMapTiles - tileUrlTemplate", async () => {
  const ctx = createTestContext();
  ctx.mockFetch(mockSessionResponse);

  try {
    const apiKey = "test-api-key";
    const googleMapTiles = new GoogleMapTiles(apiKey);
    const sessionRequest: SessionOptions = {
      mapType: MapType.Satellite,
      language: "en-US",
      region: "us",
    };

    await googleMapTiles.createSession(sessionRequest);

    const tileUrlTemplate = googleMapTiles.tileUrlTemplate();

    expect(tileUrlTemplate).toContain("key=test-api-key");
    expect(tileUrlTemplate).toContain("session=mock-session-token");
    expect(tileUrlTemplate).toContain("/v1/2dtiles/{z}/{x}/{y}");
  } finally {
    ctx.cleanup();
  }
});

test("GoogleMapTiles - tileUrl", async () => {
  const ctx = createTestContext();
  ctx.mockFetch(mockSessionResponse);

  try {
    const apiKey = "test-api-key";
    const googleMapTiles = new GoogleMapTiles(apiKey);
    const sessionRequest: SessionOptions = {
      mapType: MapType.Satellite,
      language: "en-US",
      region: "us",
    };

    await googleMapTiles.createSession(sessionRequest);

    const tileUrl = googleMapTiles.tileUrl(15, 6294, 13288);

    expect(tileUrl).toContain("key=test-api-key");
    expect(tileUrl).toContain("session=mock-session-token");
    expect(tileUrl).toContain("/15/6294/13288");
    expect(tileUrl).toContain("orientation=0");
  } finally {
    ctx.cleanup();
  }
});

test("GoogleMapTiles - expiresAt and isExpiring", async () => {
  const client = new GoogleMapTiles("test-api-key", {
    fetch: () => Promise.resolve(Response.json(mockSessionResponse)),
  });
  expect(client.expiresAt()).toBeNull();
  expect(client.isExpiring()).toBe(true);

  await client.createSession({
    mapType: MapType.Roadmap,
    language: "en-US",
    region: "us",
  });

  expect(client.expiresAt()?.getTime()).toBe(
    Number(mockSessionResponse.expiry) * 1000,
  );
  expect(client.isExpiring()).toBe(false);
  // Within a 15-day margin, a two-week session counts as expiring.
  expect(client.isExpiring(15 * 24 * 60 * 60 * 1000)).toBe(true);
});

test("GoogleMapTiles - refreshSession reuses the last options", async () => {
  const bodies: unknown[] = [];
  const client = new GoogleMapTiles("test-api-key", {
    fetch: (_url, init) => {
      bodies.push(JSON.parse(init?.body as string));
      return Promise.resolve(Response.json(mockSessionResponse));
    },
  });
  const options: SessionOptions = {
    mapType: MapType.Terrain,
    language: "fr",
    region: "fr",
  };

  await client.createSession(options);
  await client.refreshSession();

  expect(bodies).toEqual([options, options]);
});

test("GoogleMapTiles - refreshSession requires a session", async () => {
  const client = new GoogleMapTiles("test-api-key");
  await expect(client.refreshSession()).rejects.toThrow("Session not created");
});

test("GoogleMapTiles - uses fetch and baseUrl options", async () => {
  const urls: string[] = [];
  const client = new GoogleMapTiles("test-api-key", {
    baseUrl: "https://tiles.example.com",
    fetch: (url) => {
      urls.push(url);
      return Promise.resolve(Response.json(mockSessionResponse));
    },
  });

  await client.createSession({
    mapType: MapType.Roadmap,
    language: "en-US",
    region: "us",
  });

  expect(urls).toEqual([
    "https://tiles.example.com/v1/createSession?key=test-api-key",
  ]);
  expect(client.tileUrlTemplate()).toStartWith(
    "https://tiles.example.com/v1/2dtiles/{z}/{x}/{y}?",
  );
});
