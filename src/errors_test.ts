import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { TilesApiError } from "./errors.ts";
import { GoogleMapTilesProtocol } from "./maplibre_protocol.ts";
import { mockTilesApi } from "./test_helpers.ts";
import { GoogleMapTiles, LayerType, MapType } from "./tiles.ts";

afterEach(() => {
  mock.restore();
});

// Response bodies as returned by the Map Tiles API.

const INVALID_KEY = {
  error: {
    code: 400,
    message: "API key not valid. Please pass a valid API key.",
    errors: [
      {
        message: "API key not valid. Please pass a valid API key.",
        domain: "global",
        reason: "badRequest",
      },
    ],
    status: "INVALID_ARGUMENT",
    details: [
      {
        "@type": "type.googleapis.com/google.rpc.ErrorInfo",
        reason: "API_KEY_INVALID",
        domain: "googleapis.com",
        metadata: { service: "tile.googleapis.com" },
      },
      {
        "@type": "type.googleapis.com/google.rpc.LocalizedMessage",
        locale: "en-US",
        message: "API key not valid. Please pass a valid API key.",
      },
    ],
  },
};

const TERRAIN_WITHOUT_ROADS = {
  error: {
    code: 400,
    message: "The terrain map type must always contain a roadmap layer",
    errors: [
      {
        message: "The terrain map type must always contain a roadmap layer",
        domain: "global",
        reason: "badRequest",
      },
    ],
  },
};

const INVALID_SESSION = {
  error: {
    code: 401,
    message:
      '"session" URL parameter is invalid. Generate a new session token using /createSession',
    errors: [
      {
        message:
          '"session" URL parameter is invalid. Generate a new session token using /createSession',
        domain: "global",
        reason: "authError",
        location: "Authorization",
        locationType: "header",
      },
    ],
  },
};

const roadmap = { mapType: MapType.Roadmap, language: "en-US", region: "US" };

function respondWith(body: BodyInit | object, status: number) {
  return spyOn(globalThis, "fetch").mockImplementation((() =>
    Promise.resolve(
      typeof body === "string"
        ? new Response(body, { status, statusText: "Bad Gateway" })
        : Response.json(body, { status }),
    )) as unknown as typeof fetch);
}

async function caught(promise: Promise<unknown>): Promise<TilesApiError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(TilesApiError);
    return error as TilesApiError;
  }
  throw new Error("Expected a TilesApiError");
}

test("TilesApiError - invalid key uses the specific ErrorInfo reason", async () => {
  respondWith(INVALID_KEY, 400);
  const error = await caught(new GoogleMapTiles("bad").createSession(roadmap));

  expect(error).toBeInstanceOf(Error);
  expect(error.name).toBe("TilesApiError");
  expect(error.status).toBe(400);
  expect(error.reason).toBe("API_KEY_INVALID");
  expect(error.body).toEqual(INVALID_KEY.error);
  expect(error.message).toBe(
    "Error creating session: 400 API key not valid. Please pass a valid API key.",
  );
});

test("TilesApiError - invalid options fall back to the general reason", async () => {
  respondWith(TERRAIN_WITHOUT_ROADS, 400);
  const error = await caught(
    new GoogleMapTiles("key").createSession({
      ...roadmap,
      mapType: MapType.Terrain,
    }),
  );

  expect(error.status).toBe(400);
  expect(error.reason).toBe("badRequest");
  expect(error.message).toBe(
    "Error creating session: 400 The terrain map type must always contain a roadmap layer",
  );
});

test("TilesApiError - viewport with an invalid session", async () => {
  const fetchSpy = mockTilesApi();
  const client = new GoogleMapTiles("key");
  await client.createSession({
    ...roadmap,
    layerTypes: [LayerType.Roadmap],
  });
  fetchSpy.mockImplementation((() =>
    Promise.resolve(
      Response.json(INVALID_SESSION, { status: 401 }),
    )) as unknown as typeof fetch);

  const error = await caught(client.getViewport(2, 60, -60, 170, -170));
  expect(error.status).toBe(401);
  expect(error.reason).toBe("authError");
  expect(error.message).toStartWith("Error fetching viewport: 401 ");
});

test("TilesApiError - thrown by validate and the protocol handler", async () => {
  respondWith(INVALID_KEY, 400);
  const google = new GoogleMapTilesProtocol("bad");
  expect((await caught(google.validate(roadmap))).reason).toBe(
    "API_KEY_INVALID",
  );

  mock.restore();
  mockTilesApi({ tileStatus: 404 });
  const url = google
    .source(roadmap)
    .tiles[0].replace("{z}", "22")
    .replace("{x}", "0")
    .replace("{y}", "0");
  const error = await caught(
    new GoogleMapTilesProtocol("key").handler({ url }, new AbortController()),
  );
  expect(error.status).toBe(404);
  expect(error.reason).toBe("notFound");
  expect(error.message).toBe("Error fetching tile 22/0/0: 404 Not Found");
});

test("TilesApiError - responses that aren't JSON use the status text", async () => {
  respondWith("<html>Bad Gateway</html>", 502);
  const error = await caught(new GoogleMapTiles("key").createSession(roadmap));

  expect(error.status).toBe(502);
  expect(error.reason).toBeUndefined();
  expect(error.body).toBeUndefined();
  expect(error.message).toBe("Error creating session: 502 Bad Gateway");
});

test("TilesApiError - network failures are not wrapped", async () => {
  const failure = new TypeError("Failed to fetch");
  spyOn(globalThis, "fetch").mockImplementation((() =>
    Promise.reject(failure)) as unknown as typeof fetch);

  await expect(new GoogleMapTiles("key").createSession(roadmap)).rejects.toBe(
    failure,
  );
});
