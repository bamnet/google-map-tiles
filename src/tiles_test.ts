import { afterEach, expect, mock, spyOn, test } from "bun:test";
import {
  GoogleMapTiles,
  ImageFormat,
  MapType,
  Scale,
  type SessionOptions,
} from "./tiles.ts";

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

afterEach(() => {
  mock.restore();
});

/**
 * Replaces fetch with one that returns a successful session response. The
 * cast is needed because Bun's fetch type also requires `preconnect`.
 */
function mockSession() {
  return spyOn(globalThis, "fetch").mockImplementation((() =>
    Promise.resolve(
      Response.json(mockSessionResponse),
    )) as unknown as typeof fetch);
}

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
    expect(tileUrl).not.toContain("orientation");
    expect(googleMapTiles.tileUrl(15, 6294, 13288, 90)).toEndWith(
      "&orientation=90",
    );
  } finally {
    ctx.cleanup();
  }
});

test("GoogleMapTiles - expiresAt and isExpiring", async () => {
  mockSession();
  const client = new GoogleMapTiles("test-api-key");
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
  const fetchSpy = mockSession();
  const client = new GoogleMapTiles("test-api-key");
  const options: SessionOptions = {
    mapType: MapType.Terrain,
    language: "fr",
    region: "fr",
  };

  await client.createSession(options);
  await client.refreshSession();

  const bodies = fetchSpy.mock.calls.map(([, init]) =>
    JSON.parse(init?.body as string),
  );
  expect(bodies).toEqual([options, options]);
});

test("GoogleMapTiles - refreshSession requires a session", async () => {
  const client = new GoogleMapTiles("test-api-key");
  await expect(client.refreshSession()).rejects.toThrow("Session not created");
});

test("GoogleMapTiles - uses the baseUrl option", async () => {
  const fetchSpy = mockSession();
  const client = new GoogleMapTiles("test-api-key", {
    baseUrl: "https://tiles.example.com",
  });

  await client.createSession({
    mapType: MapType.Roadmap,
    language: "en-US",
    region: "us",
  });

  expect(fetchSpy.mock.calls.map(([url]) => url)).toEqual([
    "https://tiles.example.com/v1/createSession?key=test-api-key",
  ]);
  expect(client.tileUrlTemplate()).toStartWith(
    "https://tiles.example.com/v1/2dtiles/{z}/{x}/{y}?",
  );
});

test("SessionOptions - enums and their string values are interchangeable", () => {
  const withEnums: SessionOptions = {
    mapType: MapType.Satellite,
    language: "en-US",
    region: "US",
    scale: Scale.Factor2x,
    imageFormat: ImageFormat.Jpeg,
  };
  const withStrings: SessionOptions = {
    mapType: "satellite",
    language: "en-US",
    region: "US",
    scale: "scaleFactor2x",
    imageFormat: "jpeg",
  };
  // Both send the same request body.
  expect(JSON.stringify(withEnums)).toBe(JSON.stringify(withStrings));

  // Invalid values are compile errors (checked by `bun run check`).
  const invalid: SessionOptions[] = [
    // @ts-expect-error: Street View needs the Street View Tiles API.
    { mapType: "streetview", language: "en-US", region: "US" },
    // @ts-expect-error: not a scale value.
    { ...withStrings, scale: "2x" },
    // @ts-expect-error: not an image format.
    { ...withStrings, imageFormat: "webp" },
  ];
  expect(invalid).toHaveLength(3);
});
