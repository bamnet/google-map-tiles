import {
  afterEach,
  beforeEach,
  expect,
  mock,
  setSystemTime,
  test,
} from "bun:test";
import { GoogleMapsControl } from "./google_maps_control.ts";
import { addGoogleMapTiles } from "./maplibre_plugin.ts";
import { SessionPool } from "./session_pool.ts";
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
  setSystemTime();
});

/** A map with one Google source ("google") and one other ("other"). */
function setup() {
  const pool = new SessionPool("test-api-key");
  const map = new FakeMap();
  map.sources.google = {
    type: "raster",
    tiles: ["https://google/{z}/{x}/{y}"],
  };
  map.sources.other = { type: "raster", tiles: ["https://other/{z}/{x}/{y}"] };
  map.layers = [
    { id: "google", type: "raster", source: "google" },
    { id: "other", type: "raster", source: "other" },
  ];
  const control = new GoogleMapsControl((_id, tiles) =>
    tiles[0].startsWith("https://google/")
      ? () => pool.client(roadmap)
      : undefined,
  );
  return { map, control };
}

const sourcedataEvents = (map: FakeMap) =>
  map.fired.filter((e) => e.type === "sourcedata");

test("GoogleMapsControl - attributes Google sources only", async () => {
  mockTilesApi();
  const { map, control } = setup();

  map.addControl(control);
  await settle();

  expect(map.sources.google.attribution).toBe("© session-1 z3");
  expect(map.sources.other.attribution).toBeUndefined();
  expect(sourcedataEvents(map)).toEqual([
    {
      type: "sourcedata",
      data: { dataType: "source", sourceDataType: "metadata" },
    },
  ]);
});

test("GoogleMapsControl - updates after moves, firing only on change", async () => {
  const fetchSpy = mockTilesApi();
  const { map, control } = setup();
  map.addControl(control);
  await settle();

  map.fire("moveend"); // same zoom, same copyright
  await settle();
  map.zoom = 8;
  map.fire("moveend");
  await settle();

  expect(map.sources.google.attribution).toBe("© session-1 z8");
  expect(sourcedataEvents(map)).toHaveLength(2);
  const viewports = fetchSpy.mock.calls.filter(([url]) =>
    String(url).includes("viewport"),
  );
  expect(viewports).toHaveLength(3);
});

test("GoogleMapsControl - ignores hidden layers and hides the logo", async () => {
  mockTilesApi();
  const { map, control } = setup();
  map.layers[0].layout = { visibility: "none" };

  map.addControl(control);
  await settle();

  expect(map.sources.google.attribution).toBeUndefined();
  const { container } = control as unknown as { container: HTMLElement };
  expect(container.style.display).toBe("none");
});

test("GoogleMapsControl - finds sources added after the style changes", async () => {
  mockTilesApi();
  const { map, control } = setup();
  map.layers = [];
  map.addControl(control);
  await settle();

  map.sources.later = { type: "raster", tiles: ["https://google/{z}/{x}/{y}"] };
  map.addLayer({ id: "later", type: "raster", source: "later" }); // styledata
  await settle();

  expect(map.sources.later.attribution).toBe("© session-1 z3");
});

test("GoogleMapsControl - discards slower, older responses", async () => {
  // The first refresh (z3) is slow; a later one (z8) answers first.
  mockTilesApi({ viewportDelayMs: (zoom) => (zoom === "3" ? 30 : 0) });
  const { map, control } = setup();

  map.addControl(control);
  await settle();
  map.zoom = 8;
  await control.refresh();
  await new Promise((r) => setTimeout(r, 50));

  expect(map.sources.google.attribution).toBe("© session-1 z8");
});

test("GoogleMapsControl - stops listening when removed", async () => {
  const fetchSpy = mockTilesApi();
  const { map, control } = setup();
  map.addControl(control);
  await settle();

  map.removeControl(control);
  const calls = fetchSpy.mock.calls.length;
  map.fire("moveend");
  await settle();

  expect(map.listenerCount("moveend")).toBe(0);
  expect(map.listenerCount("styledata")).toBe(0);
  expect(fetchSpy.mock.calls.length).toBe(calls);
});

test("addGoogleMapTiles - points the source at a replaced session", async () => {
  mockTilesApi();
  const map = new FakeMap();
  await addGoogleMapTiles("test-api-key", map.asMap(), roadmap);
  await settle();
  expect(map.sources["google-map-tiles"].tiles?.[0]).toContain(
    "session=session-1",
  );

  setSystemTime(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)); // expired
  map.fire("moveend");
  await settle();

  const source = map.sources["google-map-tiles"];
  expect(source.tiles?.[0]).toContain("session=session-2");
  expect(source.attribution).toBe("© session-2 z3");
});

test("addGoogleMapTiles - removeFromMap cleans up", async () => {
  mockTilesApi();
  const map = new FakeMap();
  const manager = await addGoogleMapTiles("test-api-key", map.asMap(), roadmap);

  manager.removeFromMap(map.asMap());

  expect(map.sources).toEqual({});
  expect(map.layers).toEqual([]);
  expect(map.controls).toEqual([]);
  expect(map.listenerCount("moveend")).toBe(0);
});

test("GoogleMapsControl - attributes a source replaced under the same id", async () => {
  mockTilesApi();
  const { map, control } = setup();
  map.addControl(control);
  await settle();

  // What setStyle() does when a source's options change: same id, new source.
  map.sources.google = {
    type: "raster",
    tiles: ["https://google/satellite/{z}/{x}/{y}"],
  };
  map.fire("styledata");
  await settle();
  expect(map.sources.google.attribution).toBe("© session-1 z3");

  // Rebuilt with identical tiles (setStyle without diffing): still attributed.
  map.sources.google = { ...map.sources.google, attribution: undefined };
  map.fire("styledata");
  await settle();
  expect(map.sources.google.attribution).toBe("© session-1 z3");
});

test("GoogleMapsControl - one request while a style is loading", async () => {
  const fetchSpy = mockTilesApi({ viewportDelayMs: () => 20 });
  const { map, control } = setup();

  map.addControl(control);
  for (let i = 0; i < 5; i++) map.fire("styledata"); // still unattributed
  await new Promise((r) => setTimeout(r, 50));

  const viewports = fetchSpy.mock.calls.filter(([url]) =>
    String(url).includes("viewport"),
  );
  expect(viewports).toHaveLength(1);
  expect(map.sources.google.attribution).toBe("© session-1 z3");
});
