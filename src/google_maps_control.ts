// Only types are imported from maplibre-gl, so this module works with
// whichever maplibre-gl instance the application uses.
import type { ControlPosition, IControl, Map } from "maplibre-gl";
import { createGoogleLogo } from "./logo_control.ts";
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
 * shown while at least one Google source is visible.
 */
export class GoogleMapsControl implements IControl {
  private readonly resolve: GoogleSourceResolver;
  private map?: Map;
  private container?: HTMLElement;
  private sources: GoogleSourceRef[] = [];
  private sourceKey = "";
  /** The sourceKey a refresh is in flight for, if any. */
  private pendingKey?: string;
  /** Incremented per refresh, so slower, older responses are discarded. */
  private generation = 0;

  /**
   * @param resolve Identifies Google sources and the client serving each one
   */
  constructor(resolve: GoogleSourceResolver) {
    this.resolve = resolve;
  }

  getDefaultPosition(): ControlPosition {
    return "bottom-left";
  }

  /** {@inheritDoc IControl.onAdd} */
  onAdd(map: Map): HTMLElement {
    this.map = map;
    this.container = document.createElement("div");
    this.container.className = "maplibregl-ctrl";
    this.container.appendChild(createGoogleLogo());
    map.on("styledata", this.onStyleData);
    map.on("moveend", this.onMoveEnd);
    this.onStyleData();
    return this.container;
  }

  /** {@inheritDoc IControl.onRemove} */
  onRemove(map: Map): void {
    map.off("styledata", this.onStyleData);
    map.off("moveend", this.onMoveEnd);
    this.container?.remove();
    this.container = undefined;
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
          const viewport = await (await client()).getViewport(
            zoom,
            bounds.getNorth(),
            bounds.getSouth(),
            bounds.getEast(),
            bounds.getWest(),
          );
          return { id, copyright: viewport.copyright };
        } catch (error) {
          console.warn(`Failed to update attribution for "${id}":`, error);
          return undefined;
        }
      }),
    );
    if (generation !== this.generation || this.map !== map) return;

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
