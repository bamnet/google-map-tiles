import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import type { AddProtocolAction } from "maplibre-gl";
import {
  decodeTileUrl,
  encodeTileUrl,
  GoogleMapTilesProtocol,
} from "./maplibre_protocol.ts";
import type { SessionOptions } from "./tiles.ts";
import { FakeMap, fakeDocument, mockTilesApi, settle } from "./test_helpers.ts";

const roadmap: SessionOptions = {
  mapType: "roadmap",
  language: "en-US",
  region: "US",
};

beforeEach(fakeDocument);
afterEach(() => {
  mock.restore();
});

/** Fills in a template's {z}/{x}/{y} like MapLibre does. */
function tile(template: string, z: number, x: number, y: number) {
  return template
    .replace("{z}", String(z))
    .replace("{x}", String(x))
    .replace("{y}", String(y));
}

test("encodeTileUrl - readable URL without the API key", () => {
  expect(encodeTileUrl("google", roadmap)).toBe(
    "google://roadmap/{z}/{x}/{y}?language=en-US&region=US",
  );
});

test("decodeTileUrl - round-trips every option", () => {
  const options: SessionOptions = {
    mapType: "satellite",
    language: "fr",
    region: "FR",
    imageFormat: "jpeg",
    scale: "scaleFactor2x",
    highDpi: true,
    layerTypes: ["layerRoadmap", "layerTraffic"],
    overlay: false,
    apiOptions: ["MCYJ5E517XR2JC"],
    styles: [{ stylers: [{ hue: "#00ffe6" }] }],
  };
  const url = tile(encodeTileUrl("google", options), 12, 1206, 1539);

  const decoded = decodeTileUrl(url, "google");

  expect(decoded.options).toEqual(options);
  expect([decoded.z, decoded.x, decoded.y]).toEqual([12, 1206, 1539]);
});

test("decodeTileUrl - rejects other schemes", () => {
  expect(() =>
    decodeTileUrl("https://roadmap/1/2/3?language=en", "google"),
  ).toThrow("Not a google:// tile URL");
});

test("source - a raster source with protocol tiles", () => {
  const google = new GoogleMapTilesProtocol("test-api-key");
  expect(google.source(roadmap)).toEqual({
    type: "raster",
    tiles: ["google://roadmap/{z}/{x}/{y}?language=en-US&region=US"],
    tileSize: 256,
  });
});

test("handler - is a MapLibre protocol action", () => {
  const google = new GoogleMapTilesProtocol("test-api-key");
  const action: AddProtocolAction = google.handler;
  expect(action).toBeFunction();
});

test("handler - fetches tiles with one shared session", async () => {
  const fetchSpy = mockTilesApi();
  const google = new GoogleMapTilesProtocol("test-api-key");
  const template = google.source(roadmap).tiles[0];
  const abort = new AbortController();

  const [a, b] = await Promise.all([
    google.handler({ url: tile(template, 12, 1206, 1539) }, abort),
    google.handler({ url: tile(template, 12, 1207, 1539) }, abort),
  ]);

  expect(new Uint8Array(a.data)).toEqual(new Uint8Array([1, 2, 3]));
  expect(a.cacheControl).toBe("max-age=60");
  expect(b.data.byteLength).toBe(3);
  const urls = fetchSpy.mock.calls.map(([url]) => String(url));
  expect(urls.filter((u) => u.includes("createSession"))).toHaveLength(1);
  expect(urls).toContain(
    "https://tile.googleapis.com/v1/2dtiles/12/1206/1539?session=session-1&key=test-api-key",
  );
  expect(fetchSpy.mock.calls.at(-1)?.[1]?.signal).toBe(abort.signal);
});

test("handler - throws on tile errors", async () => {
  mockTilesApi({ tileStatus: 404 });
  const google = new GoogleMapTilesProtocol("test-api-key");
  const url = tile(google.source(roadmap).tiles[0], 1, 2, 3);

  await expect(google.handler({ url }, new AbortController())).rejects.toThrow(
    "Error fetching tile 1/2/3: 404 Not Found",
  );
});

test("control - attributes protocol sources with the handler's session", async () => {
  const fetchSpy = mockTilesApi();
  const google = new GoogleMapTilesProtocol("test-api-key");
  const map = new FakeMap();
  map.sources.roads = google.source(roadmap);
  map.sources.other = {
    type: "raster",
    tiles: ["https://example.com/{z}/{x}/{y}.png"],
  };
  map.layers = [
    { id: "roads", type: "raster", source: "roads" },
    { id: "other", type: "raster", source: "other" },
  ];

  map.addControl(google.control());
  await settle();
  await google.handler(
    { url: tile(map.sources.roads.tiles?.[0] as string, 3, 1, 1) },
    new AbortController(),
  );

  expect(map.sources.roads.attribution).toBe("© session-1 z3");
  expect(map.sources.other.attribution).toBeUndefined();
  const urls = fetchSpy.mock.calls.map(([url]) => String(url));
  expect(urls.filter((u) => u.includes("createSession"))).toHaveLength(1);
});

test("validate - creates the session once, reused for tiles", async () => {
  const fetchSpy = mockTilesApi();
  const google = new GoogleMapTilesProtocol("test-api-key");

  await google.validate(roadmap);
  await google.handler(
    { url: tile(google.source(roadmap).tiles[0], 1, 2, 3) },
    new AbortController(),
  );

  const urls = fetchSpy.mock.calls.map(([url]) => String(url));
  expect(urls.filter((u) => u.includes("createSession"))).toHaveLength(1);
});

test("validate - rejects bad keys", async () => {
  spyOn(globalThis, "fetch").mockImplementation((() =>
    Promise.resolve(
      Response.json(
        { error: { message: "API key not valid." } },
        { status: 400 },
      ),
    )) as unknown as typeof fetch);
  const google = new GoogleMapTilesProtocol("bad-key");

  await expect(google.validate(roadmap)).rejects.toThrow(
    "Error creating session: 400 API key not valid.",
  );
});
