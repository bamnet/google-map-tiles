import {
  createGoogleLogo,
  GOOGLE_MAPS_LOGO,
  type LogoVariant,
} from "./google_logo.ts";
import type { MapLike } from "./maplibre_types.ts";
import type { GoogleMapTiles } from "./tiles.ts";

/**
 * Identifies Google tile sources. Returns a function that gets the client
 * serving the source (with a current session), or undefined if the source
 * isn't a Google tile source.
 * @param sourceId The source's id in the style
 * @param tiles The source's tile URL templates
 */
export type GoogleSourceResolver = (
  sourceId: string,
  tiles: string[],
) => (() => Promise<GoogleMapTiles>) | undefined;

/** Options for {@link GoogleMapsControl}. */
export interface GoogleMapsControlOptions {
  /**
   * Which Google Maps logo to show. `"auto"` shows the dark-outlined logo
   * while a satellite source is visible, and the light-outlined one
   * otherwise. Set `"light"` or `"dark"` to match a custom map style.
   * @default "auto"
   */
  logo?: "auto" | LogoVariant;
}

interface GoogleSourceRef {
  id: string;
  tiles: string[];
  client: () => Promise<GoogleMapTiles>;
}

/**
 * Shows the Google Maps logo and keeps the attribution of Google tile sources
 * current, as Google's Map Tiles policies require.
 *
 * Finds Google sources in the map's style (again whenever the style changes,
 * including after `setStyle()`), and after each move sets every visible one's
 * attribution to the viewport `copyright` from the Map Tiles API. The logo is
 * shown while at least one Google source is visible, in the variant that
 * suits the imagery.
 */
export class GoogleMapsControl {
  private readonly resolve: GoogleSourceResolver;
  private readonly logoOption: "auto" | LogoVariant;
  private map?: MapLike;
  private container?: HTMLElement;
  private logo?: HTMLImageElement;
  private sources: GoogleSourceRef[] = [];
  private sourceKey = "";
  /** The sourceKey a refresh is in flight for, if any. */
  private pendingKey?: string;
  /** Incremented per refresh, so slower, older responses are discarded. */
  private generation = 0;

  /**
   * @param resolve Identifies Google sources and the client serving each one
   * @param options Optional control configuration
   */
  constructor(
    resolve: GoogleSourceResolver,
    options: GoogleMapsControlOptions = {},
  ) {
    this.resolve = resolve;
    this.logoOption = options.logo ?? "auto";
  }

  /** Where MapLibre places the control unless `addControl()` says otherwise. */
  getDefaultPosition(): "bottom-left" {
    return "bottom-left";
  }

  /** Called by MapLibre when the control is added to a map. */
  onAdd(map: MapLike): HTMLElement {
    this.map = map;
    this.container = document.createElement("div");
    this.container.className = "maplibregl-ctrl";
    // The logo carries Google's required clear space as its own margin.
    this.container.style.margin = "0";
    this.logo = createGoogleLogo(
      this.logoOption === "auto" ? "light" : this.logoOption,
    );
    this.container.appendChild(this.logo);
    map.on("styledata", this.onStyleData);
    map.on("moveend", this.onMoveEnd);
    this.onStyleData();
    return this.container;
  }

  /** Called by MapLibre when the control is removed from a map. */
  onRemove(map: MapLike): void {
    map.off("styledata", this.onStyleData);
    map.off("moveend", this.onMoveEnd);
    this.container?.remove();
    this.container = undefined;
    this.logo = undefined;
    this.map = undefined;
    this.sources = [];
    this.sourceKey = "";
    this.generation++;
  }

  /**
   * Fetches attribution for the current view and applies it. Runs
   * automatically after each move; call it to update immediately.
   */
  async refresh(): Promise<void> {
    const map = this.map;
    if (!map) return;
    const generation = ++this.generation;
    const bounds = map.getBounds();
    const zoom = Math.round(map.getZoom());

    const results = await Promise.all(
      this.sources.map(async ({ id, client }) => {
        try {
          const tiles = await client();
          const mapType = tiles.sessionOptions?.mapType;
          const viewport = await tiles.getViewport(zoom, {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest(),
          });
          return { id, mapType, copyright: viewport.copyright };
        } catch (error) {
          console.warn(`Failed to update attribution for "${id}":`, error);
          return undefined;
        }
      }),
    );
    if (generation !== this.generation || this.map !== map) return;

    if (this.logo && this.logoOption === "auto") {
      const satellite = results.some((r) => r?.mapType === "satellite");
      this.logo.src = GOOGLE_MAPS_LOGO[satellite ? "dark" : "light"].dataUri;
    }

    let changed = false;
    for (const result of results) {
      const source = result && map.getSource(result.id);
      if (source && source.attribution !== result.copyright) {
        source.attribution = result.copyright;
        changed = true;
      }
    }
    if (changed) {
      // Ask the map's attribution control to re-read source attributions.
      // AttributionControl refreshes on "sourcedata" events carrying
      // metadata, so firing one avoids depending on the AttributionControl
      // class or its private methods.
      map.fire("sourcedata", {
        dataType: "source",
        sourceDataType: "metadata",
      });
    }
  }

  private onMoveEnd = () => {
    void this.refresh();
  };

  /** Re-scans the style for visible Google sources. */
  private onStyleData = () => {
    const map = this.map;
    if (!map) return;
    const style = map.getStyle();
    if (!style) return;

    const visible = new Set(
      style.layers
        .filter((layer) => layer.layout?.visibility !== "none")
        .map((layer) => ("source" in layer ? layer.source : undefined)),
    );
    const sources: GoogleSourceRef[] = [];
    for (const [id, spec] of Object.entries(style.sources)) {
      if (!visible.has(id) || !("tiles" in spec) || !spec.tiles) continue;
      const client = this.resolve(id, spec.tiles);
      if (client) {
        sources.push({ id, tiles: spec.tiles, client });
      }
    }

    this.sources = sources;
    if (this.container) {
      this.container.style.display = sources.length ? "" : "none";
    }
    // styledata fires often, so only refresh when a source was added,
    // removed or changed, or has been replaced (e.g. by setStyle()) with one
    // that hasn't been given attribution yet.
    const key = JSON.stringify(sources.map(({ id, tiles }) => [id, tiles]));
    const unattributed = sources.some(
      ({ id }) => map.getSource(id)?.attribution === undefined,
    );
    if (key !== this.sourceKey || (unattributed && key !== this.pendingKey)) {
      this.sourceKey = key;
      this.pendingKey = key;
      void this.refresh().finally(() => {
        if (this.pendingKey === key) this.pendingKey = undefined;
      });
    }
  };
}
