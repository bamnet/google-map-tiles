import { GoogleMapTiles, MapType, type SessionOptions } from "./tiles.ts";
import { DEFAULT_ATTRIBUTION, TILE_SIZE } from "./source.ts";
// Only types are imported from maplibre-gl, so this module works with
// whichever maplibre-gl instance the application uses.
import type {
  LngLatBounds,
  Map,
  MapSourceDataEvent,
  Source,
} from "maplibre-gl";
import { addGoogleLogo, type GoogleLogoControl } from "./logo_control.ts";

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
  private logo?: GoogleLogoControl;
  private onSourceData?: (e: MapSourceDataEvent) => void;

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

  /** @inheritDoc GoogleMapTiles.tileUrlTemplate */
  get tileUrl(): string {
    return this.client.tileUrlTemplate();
  }

  /**
   * Adds the Google Maps tiles to the map.
   * @param map The MapLibre map instance
   */
  addToMap(map: Map) {
    this.addSourceAndLayer(map);
    this.setupAttribution(map);
    this.logo = addGoogleLogo(map);
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

    if (this.onSourceData) {
      map.off("sourcedata", this.onSourceData);
      this.onSourceData = undefined;
    }
    if (this.logo) {
      map.removeControl(this.logo);
      this.logo = undefined;
    }
  }

  private addSourceAndLayer(map: Map) {
    map.addSource(SOURCE_NAME, {
      type: "raster",
      tiles: [this.tileUrl],
      tileSize: TILE_SIZE,
      attribution: DEFAULT_ATTRIBUTION,
    });
    map.addLayer({
      id: LAYER_NAME,
      source: SOURCE_NAME,
      type: "raster",
    });

    this.source = map.getSource(SOURCE_NAME);
  }

  private setupAttribution(map: Map) {
    this.onSourceData = async (e) => {
      if (e.isSourceLoaded) {
        await this.updateAttribution(e.target.getBounds(), e.target.getZoom());

        // Ask the map's attribution control to re-read source attributions.
        // AttributionControl refreshes on "sourcedata" events carrying
        // metadata, so firing one avoids depending on the AttributionControl
        // class or its private methods. The event has no isSourceLoaded, so
        // it does not re-trigger this listener.
        map.fire("sourcedata", {
          dataType: "source",
          sourceDataType: "metadata",
          sourceId: SOURCE_NAME,
        });
      }
    };
    map.on("sourcedata", this.onSourceData);
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
        // The API returns an empty copyright for some viewports, such as
        // satellite imagery at certain zooms. Always credit Google.
        this.source.attribution = viewport.copyright || DEFAULT_ATTRIBUTION;
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
