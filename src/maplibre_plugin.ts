import { GoogleMapTiles, MapType, type SessionOptions } from "./tiles.ts";
import type { LngLatBounds, Map, Source } from "maplibre-gl";
import { AttributionControl } from "maplibre-gl";
import { addGoogleLogo, GoogleLogoControl } from "./logo_control.ts";

// Default options
const defaultSessionOptions: SessionOptions = {
  mapType: MapType.Roadmap,
  language: "en-US",
  region: "us",
};

const LAYER_NAME = "google-map-tiles";
const SOURCE_NAME = "google-map-tiles";

/**
 * A MapLibre plugin for Google Maps tiles to handle attribution and session management.
 *
 * @example
 * ```ts
 * const source = await GoogleMapTilesSourceManager.create("YOUR_API_KEY");
 * source.addToMap(map);
 * ```
 */
export class GoogleMapTilesSourceManager {
  readonly client: GoogleMapTiles;

  private source?: Source;

  /**
   * Creates a new GoogleMapTilesSource with an active session.
   */
  static async create(
    apiKey: string,
    options: SessionOptions = defaultSessionOptions,
  ): Promise<GoogleMapTilesSourceManager> {
    const tiles = new GoogleMapTilesSourceManager(apiKey);
    await tiles.client.createSession(options);
    return tiles;
  }

  constructor(apiKey: string) {
    this.client = new GoogleMapTiles(apiKey);
  }

  /** @inheritDoc GoogleMapTiles.tileJSONUrl */
  get tileUrl(): string {
    return this.client.tileJSONUrl();
  }

  /**
   * Adds the Google Maps tiles to the map.
   * @param map The MapLibre map instance
   */
  addToMap(map: Map) {
    this.addSourceAndLayer(map);
    this.setupAttribution(map);
    addGoogleLogo(map);
  }

  /**
   * Removes the Google Maps tiles and controls from the map.
   */
  removeFromMap(map: Map): void {
    if (map.getLayer(LAYER_NAME)) {
      map.removeLayer(LAYER_NAME);
    }
    if (map.getSource(SOURCE_NAME)) {
      map.removeSource(SOURCE_NAME);
    }

    for (const control of map._controls) {
      if (control instanceof GoogleLogoControl) {
        map.removeControl(control);
      }
    }
  }

  private addSourceAndLayer(map: Map) {
    map.addSource(SOURCE_NAME, {
      "type": "raster",
      "tiles": [this.tileUrl],
      "tileSize": 256,
    });
    map.addLayer({
      "id": LAYER_NAME,
      "source": SOURCE_NAME,
      "type": "raster",
    });

    this.source = map.getSource(SOURCE_NAME);
  }

  private setupAttribution(map: Map) {
    map.on("sourcedata", async (e) => {
      if (e.isSourceLoaded) {
        await this.updateAttribution(
          e.target.getBounds(),
          e.target.getZoom(),
        );

        map._controls.forEach((control) => {
          if (control instanceof AttributionControl) {
            // Trigger the attribution control to update its attributions.
            // This is a workaround since MapLibre doesn't expose a direct
            // update method for the attribution control.
            control._updateData({
              sourceDataType: "metadata",
              type: "",
              dataType: "source",
            });
          }
        });
      }
    });
  }

  async updateAttribution(bounds: LngLatBounds, zoom: number) {
    try {
      const z = Math.round(zoom);
      const viewport = await this.client.getViewport(
        z,
        bounds.getNorth(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getWest(),
      );

      if (this.source) {
        this.source.attribution = viewport.copyright;
      }
    } catch (error) {
      console.warn("Failed to update attribution:", error);
    }
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
