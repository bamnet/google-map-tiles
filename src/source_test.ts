import { expect, test } from "bun:test";
import {
  createGoogleSource,
  createGoogleStyle,
  DEFAULT_ATTRIBUTION,
} from "./source.ts";
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

const mockFetch = () => Promise.resolve(Response.json(mockSessionResponse));

test("createGoogleSource - returns a raster source and expiry", async () => {
  const result = await createGoogleSource("test-api-key", options, {
    fetch: mockFetch,
  });

  expect(result.source).toEqual({
    type: "raster",
    tiles: [
      "https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=mock-session-token&key=test-api-key",
    ],
    tileSize: 256,
    attribution: DEFAULT_ATTRIBUTION,
  });
  expect(result.session).toEqual(mockSessionResponse);
  expect(result.expiresAt).toEqual(new Date(1792807483 * 1000));
});

test("createGoogleSource - accepts a custom attribution", async () => {
  const { source } = await createGoogleSource("test-api-key", options, {
    fetch: mockFetch,
    attribution: "Map data © Google",
  });
  expect(source.attribution).toBe("Map data © Google");
});

test("createGoogleSource - output is plain JSON", async () => {
  const result = await createGoogleSource("test-api-key", options, {
    fetch: mockFetch,
  });
  const { source } = JSON.parse(JSON.stringify(result));
  expect(source).toEqual(result.source);
});

test("createGoogleStyle - builds a style with one layer", async () => {
  const { style, expiresAt } = await createGoogleStyle(
    "test-api-key",
    options,
    { fetch: mockFetch, sourceId: "google", layerId: "google-layer" },
  );

  expect(style.version).toBe(8);
  expect(Object.keys(style.sources)).toEqual(["google"]);
  expect(style.layers).toEqual([
    { id: "google-layer", type: "raster", source: "google" },
  ]);
  expect(expiresAt).toEqual(new Date(1792807483 * 1000));
});

test("createGoogleStyle - propagates session errors", async () => {
  const failingFetch = () =>
    Promise.resolve(
      Response.json(
        { error: { message: "API key not valid." } },
        {
          status: 400,
        },
      ),
    );
  await expect(
    createGoogleStyle("bad-key", options, { fetch: failingFetch }),
  ).rejects.toThrow("Error creating session: API key not valid.");
});
