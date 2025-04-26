import { GoogleMapTiles, MapType, type SessionOptions } from "./tiles.ts";
import type { IControl, LngLatBounds, Map } from "maplibre-gl";

interface IAttributionControl extends IControl {
  options: {
    customAttribution?: string | string[];
  };
  _updateAttributions(): void;
}

interface ILogoControl extends IControl {
  _container: HTMLImageElement;
  _map: Map;
}

// Default options
const defaultSessionOptions: SessionOptions = {
  mapType: MapType.Roadmap,
  language: "en-US",
  region: "us",
};

type AttributionControlConstructor = new (
  options: { compact: boolean },
) => IAttributionControl;

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
  readonly attributionControl: IAttributionControl;
  private static attributionControlClass: AttributionControlConstructor | null =
    null;

  protected static getOrCreateAttributionControl(
    map: Map,
    control?: IAttributionControl,
  ): IAttributionControl {
    if (control) {
      // Cache constructor from provided control if we haven't already
      if (!this.attributionControlClass) {
        this.attributionControlClass = control
          .constructor as AttributionControlConstructor;
      }
      return control;
    }

    // Use cached constructor if available
    if (this.attributionControlClass) {
      return new this.attributionControlClass({ compact: false });
    }

    // Try to find one on the map
    const existingControl = map._controls.find((
      control,
    ): control is IAttributionControl => isAttributionControl(control));
    if (!existingControl) {
      throw new Error(
        "No AttributionControl found on map. Please add one or provide it as a parameter.",
      );
    }

    // Cache the constructor for future use
    this.attributionControlClass = existingControl
      .constructor as AttributionControlConstructor;
    return new this.attributionControlClass({ compact: false });
  }

  static async createWithMap(
    apiKey: string,
    map: Map,
    options: SessionOptions = defaultSessionOptions,
    attributionControl?: IAttributionControl,
  ): Promise<GoogleMapTilesSource> {
    const control = this.getOrCreateAttributionControl(map, attributionControl);
    const tiles = await this.create(apiKey, options, control);
    tiles.addToMap(map);
    return tiles;
  }

  /**
   * Creates a new GoogleMapTilesSource with an active session.
   */
  static async create(
    apiKey: string,
    options: SessionOptions = defaultSessionOptions,
    attributionControl: IAttributionControl,
  ): Promise<GoogleMapTilesSource> {
    const tiles = new GoogleMapTilesSource(apiKey, attributionControl);
    await tiles.client.createSession(options);
    return tiles;
  }

  constructor(apiKey: string, attributionControl: IAttributionControl) {
    if (!attributionControl) {
      throw new Error("Attribution control is required");
    }
    this.client = new GoogleMapTiles(apiKey);
    this.attributionControl = attributionControl;
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
        isAttributionControl(control) &&
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
export function addGoogleMapTiles(
  apiKey: string,
  map: Map,
  options: SessionOptions = defaultSessionOptions,
  attributionControl?: IAttributionControl,
): Promise<GoogleMapTilesSource> {
  if (!apiKey) {
    throw new Error("Google Maps API key is required");
  }
  if (!map) {
    throw new Error("MapLibre map instance is required");
  }

  return GoogleMapTilesSource.createWithMap(
    apiKey,
    map,
    options,
    attributionControl,
  );
}

/**
 * Adds the Google logo to the map.
 */
export function addGoogleLogo(map: Map) {
  const logo = new GoogleLogoControl();
  map.addControl(logo, "bottom-left");
}

class GoogleLogoControl implements ILogoControl {
  _container!: HTMLImageElement;
  _map!: Map;

  onAdd(map: Map): HTMLElement {
    this._map = map;
    this._container = document.createElement("img");
    this._container.style.padding = "0px 8px";
    this._container.src =
      "https://developers.google.com/static/maps/documentation/images/google_on_white.png";
    this._container.alt = "Google Maps";
    return this._container;
  }

  onRemove(): void {
    this._container.remove();
  }
}

// Type guard for IAttributionControl
function isAttributionControl(
  control: IControl,
): control is IAttributionControl {
  return "options" in control && "_updateAttributions" in control;
}

function isDefaultAttributionControl(control: IAttributionControl) {
  const defaultAttribution =
    '<a href="https://maplibre.org/" target="_blank">MapLibre</a>';
  return control.options.customAttribution === defaultAttribution;
}
