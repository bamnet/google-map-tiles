import { assertEquals, assertRejects } from "@std/assert";
import { GoogleMapTiles, MapType, SessionRequest } from "./tiles.ts";

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
  maxZoomRects: [{
    maxZoom: 21,
    north: 41.0,
    south: 39.0,
    east: -71.0,
    west: -79.0,
  }],
};

// Setup and teardown utilities
function createTestContext() {
  const originalFetch = globalThis.fetch;
  return {
    cleanup: () => {
      globalThis.fetch = originalFetch;
    },
    mockFetch: (response: unknown, ok = true) => {
      globalThis.fetch = () =>
        Promise.resolve({
          ok,
          json: () => Promise.resolve(response),
          statusText: ok ? "OK" : "Error",
        } as Response);
    },
  };
}

Deno.test("GoogleMapTiles - createSession", async () => {
  const ctx = createTestContext();
  ctx.mockFetch(mockSessionResponse);

  try {
    const apiKey = "test-api-key";
    const googleMapTiles = new GoogleMapTiles(apiKey);
    const sessionRequest: SessionRequest = {
      mapType: MapType.Satellite,
      language: "en-US",
      region: "us",
    };

    const session = await googleMapTiles.createSession(sessionRequest);
    assertEquals(session, mockSessionResponse);
  } finally {
    ctx.cleanup();
  }
});

Deno.test("GoogleMapTiles - createSession failure", async () => {
  const ctx = createTestContext();
  ctx.mockFetch({}, false);

  try {
    const apiKey = "test-api-key";
    const googleMapTiles = new GoogleMapTiles(apiKey);
    const sessionRequest: SessionRequest = {
      mapType: MapType.Satellite,
      language: "en-US",
      region: "us",
    };

    await assertRejects(
      async () => {
        await googleMapTiles.createSession(sessionRequest);
      },
      Error,
      "Error creating session",
    );
  } finally {
    ctx.cleanup();
  }
});

Deno.test("GoogleMapTiles - getViewport", async () => {
  const ctx = createTestContext();
  ctx.mockFetch(mockSessionResponse);

  try {
    const apiKey = "test-api-key";
    const googleMapTiles = new GoogleMapTiles(apiKey);
    const sessionRequest: SessionRequest = {
      mapType: MapType.Satellite,
      language: "en-US",
      region: "us",
    };

    await googleMapTiles.createSession(sessionRequest);

    ctx.mockFetch(mockViewportResponse);
    const viewport = await googleMapTiles.getViewport(10, 40, 30, -70, -80);
    assertEquals(viewport, mockViewportResponse);
  } finally {
    ctx.cleanup();
  }
});

Deno.test("GoogleMapTiles - getViewport failure", async () => {
  const ctx = createTestContext();
  ctx.mockFetch(mockSessionResponse);

  try {
    const apiKey = "test-api-key";
    const googleMapTiles = new GoogleMapTiles(apiKey);
    const sessionRequest: SessionRequest = {
      mapType: MapType.Satellite,
      language: "en-US",
      region: "us",
    };

    await googleMapTiles.createSession(sessionRequest);

    ctx.mockFetch({}, false);
    await assertRejects(
      async () => {
        await googleMapTiles.getViewport(10, 40, 30, -70, -80);
      },
      Error,
      "Error fetching viewport",
    );
  } finally {
    ctx.cleanup();
  }
});

Deno.test("GoogleMapTiles - tileUrl", async () => {
  const ctx = createTestContext();
  ctx.mockFetch(mockSessionResponse);

  try {
    const apiKey = "test-api-key";
    const googleMapTiles = new GoogleMapTiles(apiKey);
    const sessionRequest: SessionRequest = {
      mapType: MapType.Satellite,
      language: "en-US",
      region: "us",
    };

    await googleMapTiles.createSession(sessionRequest);

    const tileUrl = googleMapTiles.tileUrl(15, 6294, 13288);

    assertEquals(tileUrl.includes("key=test-api-key"), true);
    assertEquals(tileUrl.includes("session=mock-session-token"), true);
    assertEquals(tileUrl.includes("/15/6294/13288"), true);
    assertEquals(tileUrl.includes("orientation=0"), true);
  } finally {
    ctx.cleanup();
  }
});
