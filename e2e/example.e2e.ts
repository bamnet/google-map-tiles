import { crc32, deflateSync } from "node:zlib";
import { expect, type Page, test } from "@playwright/test";
import { GOOGLE_MAPS_LOGO } from "../core.ts";

// Runs the built example against a stub of the Map Tiles API. Each map type's
// tiles are a solid color, so the test can tell from the rendered map which
// session's tiles are drawn.

type RGB = [number, number, number];

const COLORS: Record<string, RGB> = {
  roadmap: [220, 60, 60],
  satellite: [40, 90, 200],
  terrain: [60, 160, 80],
};

/** A 1×1 PNG of one color. MapLibre stretches it over the whole tile. */
function solidPng([r, g, b]: RGB): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  // 1×1, 8-bit RGB.
  const header = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.from([0, r, g, b]))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

interface SessionRequest {
  mapType: string;
  layerTypes?: string[];
}

/** Requests the stub received. */
interface StubLog {
  sessions: { key: string | null; body: SessionRequest }[];
  tiles: URL[];
}

/**
 * Replaces the Map Tiles API with a stub, and blocks all other requests
 * that leave localhost. Like the real API, sessions for terrain without the
 * roads layer are rejected.
 */
async function stubGoogle(page: Page): Promise<StubLog> {
  const log: StubLog = { sessions: [], tiles: [] };
  const mapTypes = new Map<string, string>();

  await page.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.abort());
  await page.route("https://tile.googleapis.com/**", async (route) => {
    const url = new URL(route.request().url());
    const mapType = mapTypes.get(url.searchParams.get("session") ?? "");

    if (url.pathname === "/v1/createSession") {
      const body = route.request().postDataJSON() as SessionRequest;
      log.sessions.push({ key: url.searchParams.get("key"), body });
      if (
        body.mapType === "terrain" &&
        !body.layerTypes?.includes("layerRoadmap")
      ) {
        const message =
          "The terrain map type must always contain a roadmap layer";
        return route.fulfill({
          status: 400,
          json: {
            error: {
              code: 400,
              message,
              errors: [{ message, domain: "global", reason: "badRequest" }],
            },
          },
        });
      }
      const session = `session-${log.sessions.length}`;
      mapTypes.set(session, body.mapType);
      return route.fulfill({
        json: {
          session,
          expiry: String(Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60),
          tileWidth: 256,
          tileHeight: 256,
          imageFormat: "png",
        },
      });
    }
    if (url.pathname.startsWith("/v1/2dtiles/") && mapType) {
      log.tiles.push(url);
      return route.fulfill({
        contentType: "image/png",
        body: solidPng(COLORS[mapType]),
      });
    }
    if (url.pathname === "/tile/v1/viewport" && mapType) {
      return route.fulfill({
        json: { copyright: `Stub ${mapType} data`, maxZoomRects: [] },
      });
    }
    return route.fulfill({ status: 404, json: { error: { code: 404 } } });
  });
  return log;
}

/** The color at the center of the rendered map. */
async function centerColor(page: Page): Promise<RGB> {
  const png = await page.locator("#map").screenshot();
  return await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d") as CanvasRenderingContext2D;
    context.drawImage(image, 0, 0);
    const x = Math.floor(image.width / 2);
    const y = Math.floor(image.height / 2);
    const [r, g, b] = context.getImageData(x, y, 1, 1).data;
    return [r, g, b] as RGB;
  }, png.toString("base64"));
}

/** Waits until the map's center shows the given color. */
async function expectMapColor(page: Page, expected: RGB) {
  await expect
    .poll(async () => {
      const actual = await centerColor(page);
      return actual.every((c, i) => Math.abs(c - expected[i]) <= 3);
    })
    .toBe(true);
}

const attribution = (page: Page) =>
  page.locator(".maplibregl-ctrl-attrib-inner");
const logo = (page: Page) => page.getByRole("img", { name: "Google Maps" });

let problems: string[];

test.beforeEach(({ page }) => {
  problems = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error}`));
  page.on("console", (message) => {
    // Only errors: Chrome logs GPU warnings when the test takes screenshots.
    if (message.type() === "error") {
      problems.push(`${message.type()}: ${message.text()}`);
    }
  });
});

test("shows Google tiles, attribution and the logo", async ({ page }) => {
  const log = await stubGoogle(page);
  await page.goto("/");

  await expectMapColor(page, COLORS.roadmap);
  await expect(attribution(page)).toHaveText("Stub roadmap data | MapLibre");
  await expect(logo(page)).toBeVisible();
  await expect(logo(page)).toHaveAttribute(
    "src",
    GOOGLE_MAPS_LOGO.light.dataUri,
  );

  expect(log.sessions).toHaveLength(1);
  expect(log.sessions[0].key).toBe("e2e-test-key");
  expect(log.sessions[0].body).toMatchObject({
    mapType: "roadmap",
    language: "en-US",
    region: "us",
  });
  expect(log.tiles.length).toBeGreaterThan(0);
  expect(problems).toEqual([]);
});

test("changing the map type swaps tiles, attribution and logo", async ({
  page,
}) => {
  const log = await stubGoogle(page);
  await page.goto("/");
  await expect(attribution(page)).toHaveText("Stub roadmap data | MapLibre");

  // The example replaces the source with setStyle().
  log.tiles = [];
  await page.locator("#mapType").selectOption("satellite");

  await expectMapColor(page, COLORS.satellite);
  await expect(attribution(page)).toHaveText("Stub satellite data | MapLibre");
  await expect(logo(page)).toHaveAttribute(
    "src",
    GOOGLE_MAPS_LOGO.dark.dataUri,
  );
  expect(log.sessions.map((s) => s.body.mapType)).toEqual([
    "roadmap",
    "satellite",
  ]);
  // The API rejects satellite tiles with an orientation parameter.
  expect(log.tiles.length).toBeGreaterThan(0);
  for (const tile of log.tiles) {
    expect(tile.searchParams.has("orientation")).toBe(false);
  }
  expect(problems).toEqual([]);
});

test("invalid options are reported and leave the map as it was", async ({
  page,
}) => {
  const log = await stubGoogle(page);
  await page.goto("/");
  await expect(attribution(page)).toHaveText("Stub roadmap data | MapLibre");

  await page.locator("#mapType").selectOption("terrain");

  await expect
    .poll(() => problems)
    .toContainEqual(
      expect.stringContaining(
        "The terrain map type must always contain a roadmap layer",
      ),
    );
  expect(log.sessions.map((s) => s.body.mapType)).toEqual([
    "roadmap",
    "terrain",
  ]);
  await expectMapColor(page, COLORS.roadmap);
  await expect(attribution(page)).toHaveText("Stub roadmap data | MapLibre");

  // With the roads layer, terrain is accepted.
  await page.locator("#layerType").selectOption("layerRoadmap");
  await expectMapColor(page, COLORS.terrain);
  await expect(attribution(page)).toHaveText("Stub terrain data | MapLibre");
  await expect(logo(page)).toHaveAttribute(
    "src",
    GOOGLE_MAPS_LOGO.light.dataUri,
  );
  // Nothing went wrong besides the rejected session, which Chrome also logs.
  expect(
    problems.filter(
      (p) =>
        !p.includes("terrain map type must always") &&
        !p.includes("status of 400 (Bad Request)"),
    ),
  ).toEqual([]);
});
