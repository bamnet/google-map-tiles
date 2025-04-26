import { GoogleMapTiles, MapType, SessionOptions } from "./tiles.ts";

import { AttributionControl, LogoControl } from "maplibre-gl";
import type { LngLatBounds, Map } from "maplibre-gl";

const defaultSessionOptions: SessionOptions = {
  mapType: MapType.Roadmap,
  language: "en-US",
  region: "us",
};

export class GoogleMapTilesSource {
  private client: GoogleMapTiles;
  attributionControl: AttributionControl;

  constructor(apiKey: string) {
    this.client = new GoogleMapTiles(apiKey);
    this.attributionControl = new AttributionControl();
  }

  /** @inheritDoc GoogleMapTiles.tileJSONUrl */
  get tileUrl() {
    return this.client.tileJSONUrl();
  }

  async updateAttribution(bounds: LngLatBounds, zoom: number) {
    // Round the zoom level to the nearest integer.
    const z = Math.round(zoom);

    const viewport = await this.client.getViewport(
      z,
      bounds.getNorth(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getWest(),
    );

    if (
      this.attributionControl.options.customAttribution != viewport.copyright
    ) {
      this.attributionControl.options.customAttribution = viewport.copyright;
      this.attributionControl._updateAttributions();
    }
  }

  static async create(
    apiKey: string,
    options: SessionOptions = defaultSessionOptions,
  ) {
    const tiles = new GoogleMapTilesSource(apiKey);
    await tiles.client.createSession(options);
    return tiles;
  }

  static addLogo(map: Map) {
    const logo = new GoogleLogoControl();
    map.addControl(logo, "bottom-left");
  }
}

export class GoogleLogoControl extends LogoControl {
  declare _container: HTMLImageElement;

  override onAdd(map: Map): HTMLElement {
    this._map = map;
    this._container = document.createElement("img");
    this._container.style.padding = "0px 8px";
    this._container.src =
      "https://developers.google.com/static/maps/documentation/images/google_on_white.png";
    return this._container;
  }
}
