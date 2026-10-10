import { expect, test } from "bun:test";
import { GoogleMapTiles, MapType, type SessionOptions } from "./tiles.ts";

// Mock responses
const mockSessionResponse = {
  session: "mock-session-token",
  expiry: new Date(Date.now() + 3600000).toISOString(),
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

test("GoogleMapTiles - tileJSONUrl", async () => {
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

    const tileJSONUrl = googleMapTiles.tileJSONUrl();

    expect(tileJSONUrl).toContain("key=test-api-key");
    expect(tileJSONUrl).toContain("session=mock-session-token");
    expect(tileJSONUrl).toContain("/v1/2dtiles/{z}/{x}/{y}");
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
