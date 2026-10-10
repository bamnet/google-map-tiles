import { expect, test } from "bun:test";
import { MAX_LATITUDE, tileAt, tileBounds } from "./tile_math.ts";

const NYC = { lat: 40.7128, lng: -74.006 };

test("tileAt - known tiles", () => {
  expect(tileAt(NYC, 0)).toEqual({ z: 0, x: 0, y: 0 });
  expect(tileAt({ lat: 0.1, lng: 0.1 }, 1)).toEqual({ z: 1, x: 1, y: 0 });
  expect(tileAt({ lat: -0.1, lng: -0.1 }, 1)).toEqual({ z: 1, x: 0, y: 1 });
  expect(tileAt(NYC, 12)).toEqual({ z: 12, x: 1205, y: 1540 });
});

test("tileAt - wraps longitude and clamps latitude", () => {
  expect(tileAt({ lat: 0, lng: 180 }, 3).x).toBe(0);
  expect(tileAt({ lat: 0, lng: -180 }, 3).x).toBe(0);
  expect(tileAt({ lat: 0, lng: 179.999 }, 3).x).toBe(7);
  expect(tileAt({ ...NYC, lng: NYC.lng + 360 }, 12)).toEqual(tileAt(NYC, 12));
  expect(tileAt({ ...NYC, lng: NYC.lng - 720 }, 12)).toEqual(tileAt(NYC, 12));
  expect(tileAt({ lat: 90, lng: 0 }, 3).y).toBe(0);
  expect(tileAt({ lat: -90, lng: 0 }, 3).y).toBe(7);
});

test("tileBounds - the whole world at zoom 0", () => {
  const world = tileBounds(0, 0, 0);
  expect(world.west).toBe(-180);
  expect(world.east).toBe(180);
  expect(world.north).toBeCloseTo(MAX_LATITUDE, 10);
  expect(world.south).toBeCloseTo(-MAX_LATITUDE, 10);
});

test("tileBounds - neighboring tiles share edges", () => {
  const tile = tileBounds(12, 1206, 1539);
  expect(tileBounds(12, 1207, 1539).west).toBe(tile.east);
  expect(tileBounds(12, 1206, 1540).north).toBe(tile.south);
  expect(tile.north).toBeGreaterThan(tile.south);
  expect(tile.east).toBeGreaterThan(tile.west);
});

test("tileAt and tileBounds agree", () => {
  for (let i = 0; i < 1000; i++) {
    const point = {
      lat: (Math.random() * 2 - 1) * MAX_LATITUDE,
      lng: Math.random() * 360 - 180,
    };
    const { z, x, y } = tileAt(point, Math.floor(Math.random() * 23));
    const bounds = tileBounds(z, x, y);
    expect(point.lat).toBeLessThanOrEqual(bounds.north);
    expect(point.lat).toBeGreaterThanOrEqual(bounds.south);
    expect(point.lng).toBeLessThanOrEqual(bounds.east);
    expect(point.lng).toBeGreaterThanOrEqual(bounds.west);
  }
});

test("rejects invalid zooms and tiles", () => {
  expect(() => tileAt(NYC, -1)).toThrow(RangeError);
  expect(() => tileAt(NYC, 1.5)).toThrow("Zoom must be a whole number");
  expect(() => tileBounds(2, 4, 0)).toThrow(
    "Tile x must be a whole number from 0 to 3 at zoom 2: 4",
  );
  expect(() => tileBounds(2, 0, -1)).toThrow("Tile y must be");
  expect(() => tileBounds(2, 0.5, 0)).toThrow(RangeError);
});
