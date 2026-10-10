import { type GoogleMapTiles, MapType, type SessionOptions } from "./tiles.ts";
import { TILE_SIZE } from "./maplibre_style.ts";
import { SessionPool } from "./session_pool.ts";
import { GoogleMapsControl } from "./google_maps_control.ts";
// Only types are imported from maplibre-gl, so this module works with
// whichever maplibre-gl instance the application uses.
import type { Map } from "maplibre-gl";

// Default options
const defaultSessionOptions: SessionOptions = {
  mapType: MapType.Roadmap,
  language: "en-US",
  region: "us",
};

const LAYER_NAME = "google-map-tiles";
const SOURCE_NAME = "google-map-tiles";

/**
 * Adds Google tiles to a MapLibre map as a source and layer, with the Google
 * Maps logo and attribution kept current. The session is replaced before it
 * expires, and the source's tile URLs are updated to match.
 *
 * To declare Google tiles in a style instead, see `GoogleMapTilesProtocol`.
 *
 * @example
 * ```ts
 * const source = await GoogleMapTilesSourceManager.create("YOUR_API_KEY");
 * source.addToMap(map);
 * ```
 */
export class GoogleMapTilesSourceManager {
  private readonly pool: SessionPool;
  private readonly options: SessionOptions;
  private current?: GoogleMapTiles;
  private control?: GoogleMapsControl;

  /**
   * Creates a new GoogleMapTilesSourceManager with an active session.
   * @throws {Error} If the session can't be created
   */
  static async create(
    apiKey: string,
    options: SessionOptions = defaultSessionOptions,
  ): Promise<GoogleMapTilesSourceManager> {
    const manager = new GoogleMapTilesSourceManager(apiKey, options);
    manager.current = await manager.pool.client(options);
    return manager;
  }

  private constructor(apiKey: string, options: SessionOptions) {
    this.pool = new SessionPool(apiKey);
    this.options = options;
  }

  /** The client for the current session. */
  get client(): GoogleMapTiles {
    if (!this.current) {
      throw new Error(
        "Session not created. Use GoogleMapTilesSourceManager.create().",
      );
    }
    return this.current;
  }

  /** @inheritDoc GoogleMapTiles.tileUrlTemplate */
  get tileUrl(): string {
    return this.client.tileUrlTemplate();
  }

  /**
   * Adds the Google Maps tiles, logo and attribution to the map.
   * @param map The MapLibre map instance
   */
  addToMap(map: Map) {
    map.addSource(SOURCE_NAME, {
      type: "raster",
      tiles: [this.tileUrl],
      tileSize: TILE_SIZE,
    });
    map.addLayer({
      id: LAYER_NAME,
      source: SOURCE_NAME,
      type: "raster",
    });

    this.control = new GoogleMapsControl((id) =>
      id === SOURCE_NAME ? () => this.currentClient(map) : undefined,
    );
    map.addControl(this.control);
  }

  /**
   * Removes the Google Maps tiles, logo and attribution from the map.
   */
  removeFromMap(map: Map): void {
    if (this.control) {
      map.removeControl(this.control);
      this.control = undefined;
    }
    if (map.getLayer(LAYER_NAME)) {
      map.removeLayer(LAYER_NAME);
    }
    if (map.getSource(SOURCE_NAME)) {
      map.removeSource(SOURCE_NAME);
    }
  }

  /**
   * Returns a client with a current session. If the pool replaced the
   * session, points the source's tiles at the new one.
   */
  private async currentClient(map: Map): Promise<GoogleMapTiles> {
    const client = await this.pool.client(this.options);
    if (client !== this.current) {
      this.current = client;
      const source = map.getSource(SOURCE_NAME) as
        | { setTiles?: (tiles: string[]) => unknown }
        | undefined;
      source?.setTiles?.([client.tileUrlTemplate()]);
    }
    return client;
  }
}

/**
 * Helper function to add Google Maps tiles to a MapLibre map.
 */
export async function addGoogleMapTiles(
  apiKey: string,
  map: Map,
  options?: SessionOptions,
): Promise<GoogleMapTilesSourceManager> {
  if (!apiKey) {
    throw new Error("Google Maps API key is required");
  }
  if (!map) {
    throw new Error("MapLibre map instance is required");
  }

  const googleMapTiles = await GoogleMapTilesSourceManager.create(
    apiKey,
    options,
  );
  googleMapTiles.addToMap(map);
  return googleMapTiles;
}
