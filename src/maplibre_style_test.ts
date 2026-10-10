import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { createGoogleSource, createGoogleStyle } from "./maplibre_style.ts";
import { MapType, type SessionOptions } from "./tiles.ts";

const mockSessionResponse = {
  session: "mock-session-token",
  expiry: "1792807483",
  tileWidth: 512,
  tileHeight: 512,
  imageFormat: "png",
};

const options: SessionOptions = {
  mapType: MapType.Roadmap,
  language: "en-US",
  region: "us",
};

afterEach(() => {
  mock.restore();
});

/**
 * Replaces fetch with one that returns `body` as JSON. The cast is needed
 * because Bun's fetch type also requires `preconnect`.
 */
function mockFetch(body: unknown, init?: ResponseInit) {
  return spyOn(globalThis, "fetch").mockImplementation((() =>
    Promise.resolve(Response.json(body, init))) as unknown as typeof fetch);
}

test("createGoogleSource - returns a raster source and expiry", async () => {
  mockFetch(mockSessionResponse);
  const result = await createGoogleSource("test-api-key", options);

  expect(result.source).toEqual({
    type: "raster",
    tiles: [
      "https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=mock-session-token&key=test-api-key",
    ],
    tileSize: 256,
  });
  expect(result.source.attribution).toBeUndefined();
  expect(result.session).toEqual(mockSessionResponse);
  expect(result.expiresAt).toEqual(new Date(1792807483 * 1000));
});

test("createGoogleSource - accepts an attribution", async () => {
  mockFetch(mockSessionResponse);
  const { source } = await createGoogleSource("test-api-key", options, {
    attribution: "Map data ©2026 Google",
  });
  expect(source.attribution).toBe("Map data ©2026 Google");
});

test("createGoogleSource - output is plain JSON", async () => {
  mockFetch(mockSessionResponse);
  const result = await createGoogleSource("test-api-key", options);
  const { source } = JSON.parse(JSON.stringify(result));
  expect(source).toEqual(result.source);
});

test("createGoogleStyle - builds a style with one layer", async () => {
  mockFetch(mockSessionResponse);
  const { style, expiresAt } = await createGoogleStyle(
    "test-api-key",
    options,
    { sourceId: "google", layerId: "google-layer" },
  );

  expect(style.version).toBe(8);
  expect(Object.keys(style.sources)).toEqual(["google"]);
  expect(style.layers).toEqual([
    { id: "google-layer", type: "raster", source: "google" },
  ]);
  expect(expiresAt).toEqual(new Date(1792807483 * 1000));
});

test("createGoogleStyle - propagates session errors", async () => {
  mockFetch({ error: { message: "API key not valid." } }, { status: 400 });
  await expect(createGoogleStyle("bad-key", options)).rejects.toThrow(
    "Error creating session: 400 API key not valid.",
  );
});
