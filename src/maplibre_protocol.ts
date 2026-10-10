// Only types are imported from maplibre-gl, so this module works with
// whichever maplibre-gl instance the application uses.
import type { GetResourceResponse, RequestParameters } from "maplibre-gl";
import {
  GoogleMapsControl,
  type GoogleMapsControlOptions,
} from "./google_maps_control.ts";
import { type RasterSource, TILE_SIZE } from "./maplibre_style.ts";
import { SessionPool, type SessionPoolOptions } from "./session_pool.ts";
import type { LayerType, SessionOptions } from "./tiles.ts";

/** Options for constructing a {@link GoogleMapTilesProtocol}. */
export interface ProtocolOptions extends SessionPoolOptions {
  /**
   * The URL scheme to handle. Must match the name passed to maplibre-gl's
   * `addProtocol()`.
   * @default "google"
   */
  scheme?: string;
}

/**
 * Serves Google tiles to MapLibre GL JS through a custom URL protocol, so
 * Google tiles can be declared in a style like any other source.
 *
 * Sources use URLs such as `google://roadmap/{z}/{x}/{y}?language=en-US&region=US`,
 * which carry the session options but not the API key. Sessions are created
 * on first use, shared across sources with the same options, and replaced
 * before they expire.
 *
 * @example
 * ```ts
 * import { addProtocol, Map } from "maplibre-gl";
 *
 * const google = new GoogleMapTilesProtocol("YOUR_API_KEY");
 * addProtocol("google", google.handler);
 *
 * const map = new Map({
 *   container: "map",
 *   style: {
 *     version: 8,
 *     sources: {
 *       google: google.source({ mapType: "roadmap", language: "en-US", region: "US" }),
 *     },
 *     layers: [{ id: "google", type: "raster", source: "google" }],
 *   },
 * });
 * map.addControl(google.control());
 * ```
 */
export class GoogleMapTilesProtocol {
  readonly scheme: string;
  readonly pool: SessionPool;

  /**
   * @param apiKey Google Maps API key
   * @param options Optional protocol, pool and client configuration
   */
  constructor(apiKey: string, options: ProtocolOptions = {}) {
    this.scheme = options.scheme ?? "google";
    this.pool = new SessionPool(apiKey, options);
  }

  /**
   * The protocol handler. Pass it to maplibre-gl's `addProtocol()` with
   * {@link scheme} as the protocol name.
   */
  readonly handler = async (
    request: RequestParameters,
    abortController: AbortController,
  ): Promise<GetResourceResponse<ArrayBuffer>> => {
    const { options, z, x, y } = decodeTileUrl(request.url, this.scheme);
    const client = await this.pool.client(options);
    const response = await fetch(client.tileUrl(z, x, y), {
      signal: abortController.signal,
    });
    if (!response.ok) {
      throw new Error(
        `Error fetching tile ${z}/${x}/${y}: ${response.status} ${response.statusText}`,
      );
    }
    return {
      data: await response.arrayBuffer(),
      cacheControl: response.headers.get("cache-control"),
      expires: response.headers.get("expires"),
    };
  };

  /**
   * Creates the session for these options now, so that a bad API key or
   * invalid options fail here, instead of as tile errors once the map loads.
   * The session is then reused for tiles.
   * @throws {Error} If the session can't be created
   */
  async validate(options: SessionOptions): Promise<void> {
    await this.pool.client(options);
  }

  /**
   * Creates a raster source for a style. No request is made until the map
   * loads tiles, and the source contains no API key.
   */
  source(options: SessionOptions): RasterSource {
    return {
      type: "raster",
      tiles: [encodeTileUrl(this.scheme, options)],
      tileSize: TILE_SIZE,
    };
  }

  /**
   * Creates a control that shows the Google Maps logo and keeps attribution
   * current for every source this protocol serves. Add it with
   * `map.addControl()`.
   */
  control(options?: GoogleMapsControlOptions): GoogleMapsControl {
    return new GoogleMapsControl((_id, tiles) => {
      const url = tiles.find((t) => t.startsWith(`${this.scheme}://`));
      if (!url) return undefined;
      const session = decodeTileUrl(url, this.scheme).options;
      return () => this.pool.client(session);
    }, options);
  }
}

/**
 * Builds a protocol tile URL template for these session options, e.g.
 * `google://roadmap/{z}/{x}/{y}?language=en-US&region=US`.
 */
export function encodeTileUrl(scheme: string, options: SessionOptions): string {
  const params = new URLSearchParams();
  const set = (key: string, value: unknown) => {
    if (value !== undefined) params.set(key, String(value));
  };
  set("language", options.language);
  set("region", options.region);
  set("imageFormat", options.imageFormat);
  set("scale", options.scale);
  set("highDpi", options.highDpi);
  set("layerTypes", options.layerTypes?.join(","));
  set("overlay", options.overlay);
  set("apiOptions", options.apiOptions?.join(","));
  if (options.styles) set("styles", JSON.stringify(options.styles));
  return `${scheme}://${options.mapType}/{z}/{x}/{y}?${params}`;
}

/**
 * Parses a protocol tile URL (with `{z}/{x}/{y}` filled in, or not) back into
 * session options and tile coordinates.
 * @throws {Error} If the URL doesn't use this scheme
 */
export function decodeTileUrl(
  url: string,
  scheme: string,
): { options: SessionOptions; z: number; x: number; y: number } {
  if (!url.startsWith(`${scheme}://`)) {
    throw new Error(`Not a ${scheme}:// tile URL: ${url}`);
  }
  // Parse as https so hostname and path are split the same way everywhere.
  const parsed = new URL(`https://${url.slice(scheme.length + 3)}`);
  const [z, x, y] = parsed.pathname.split("/").slice(1).map(Number);
  const params = parsed.searchParams;
  const list = (key: string) => params.get(key)?.split(",").filter(Boolean);
  const bool = (key: string) =>
    params.has(key) ? params.get(key) === "true" : undefined;

  // Absent options stay undefined, which JSON (and so the API and
  // sessionKey) ignores.
  const options: SessionOptions = {
    mapType: parsed.hostname as SessionOptions["mapType"],
    language: params.get("language") ?? "",
    region: params.get("region") ?? "",
    imageFormat: params.get("imageFormat") ?? undefined,
    scale: params.get("scale") ?? undefined,
    highDpi: bool("highDpi"),
    layerTypes: list("layerTypes") as LayerType[] | undefined,
    overlay: bool("overlay"),
    apiOptions: list("apiOptions"),
    styles: params.has("styles")
      ? JSON.parse(params.get("styles") as string)
      : undefined,
  };
  return { options, z, x, y };
}
