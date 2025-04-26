import { GoogleMapTiles, MapType, SessionOptions } from "./tiles.ts";
import { AttributionControl, LogoControl } from "maplibre-gl";
import type { LngLatBounds, Map } from "maplibre-gl";

// Default options
const defaultSessionOptions: SessionOptions = {
  mapType: MapType.Roadmap,
  language: "en-US",
  region: "us",
};

/**
 * A MapLibre source for Google Maps tiles that handles attribution and session management.
 *
 * @example
 * ```ts
 * const source = await GoogleMapTilesSource.create("YOUR_API_KEY");
 * source.addToMap(map);
 * ```
 */
export class GoogleMapTilesSource {
  readonly client: GoogleMapTiles;
  readonly attributionControl: AttributionControl;

  /**
   * Creates a new GoogleMapTilesSource with an active session.
   */
  static async create(
    apiKey: string,
    options: SessionOptions = defaultSessionOptions,
  ) {
    const tiles = new GoogleMapTilesSource(apiKey);
    await tiles.client.createSession(options);
    return tiles;
  }

  constructor(apiKey: string) {
    this.client = new GoogleMapTiles(apiKey);
    this.attributionControl = new AttributionControl({ compact: false });
  }

  /** @inheritDoc GoogleMapTiles.tileJSONUrl */
  get tileUrl() {
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
    if (map.getLayer("google-map-tiles")) {
      map.removeLayer("google-map-tiles");
    }
    if (map.getSource("google-map-tiles")) {
      map.removeSource("google-map-tiles");
    }
    map.removeControl(this.attributionControl);

    for (const control of map._controls) {
      if (control instanceof GoogleLogoControl) {
        map.removeControl(control);
      }
    }
  }

  private addSourceAndLayer(map: Map) {
    map.addSource("google-map-tiles", {
      "type": "raster",
      "tiles": [this.tileUrl],
      "tileSize": 256,
    });
    map.addLayer({
      "id": "google-map-tiles",
      "source": "google-map-tiles",
      "type": "raster",
    });
  }

  private setupAttribution(map: Map) {
    map._controls.forEach((control) => {
      if (
        control instanceof AttributionControl &&
        isDefaultAttributionControl(control)
      ) {
        map.removeControl(control);
      }
    });

    map.addControl(this.attributionControl, "bottom-right");
    map.on("sourcedata", (e) => {
      if (e.isSourceLoaded) {
        this.updateAttribution(e.target.getBounds(), e.target.getZoom());
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

      if (
        this.attributionControl.options.customAttribution !== viewport.copyright
      ) {
        this.attributionControl.options.customAttribution = viewport.copyright;
        this.attributionControl._updateAttributions();
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
): Promise<GoogleMapTilesSource> {
  if (!apiKey) {
    throw new Error("Google Maps API key is required");
  }
  if (!map) {
    throw new Error("MapLibre map instance is required");
  }

  const googleMapTiles = await GoogleMapTilesSource.create(apiKey, options);
  googleMapTiles.addToMap(map);
  return googleMapTiles;
}

/**
 * Adds the Google logo to the map.
 */
export function addGoogleLogo(map: Map) {
  const logo = new GoogleLogoControl();
  map.addControl(logo, "bottom-left");
}

class GoogleLogoControl extends LogoControl {
  declare _container: HTMLImageElement;

  override onAdd(map: Map): HTMLElement {
    this._map = map;
    this._container = document.createElement("img");
    this._container.style.padding = "0px 8px";
    this._container.src =
      "https://developers.google.com/static/maps/documentation/images/google_on_white.png";
    this._container.alt = "Google Maps";
    return this._container;
  }
}

function isDefaultAttributionControl(control: AttributionControl) {
  const defaultAttribution =
    '<a href="https://maplibre.org/" target="_blank">MapLibre</a>';
  return control.options.customAttribution === defaultAttribution;
}
