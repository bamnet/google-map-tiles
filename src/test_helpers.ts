// Test-only fakes: a scripted Map Tiles API and a minimal MapLibre map.
import { spyOn } from "bun:test";
import type { Map } from "maplibre-gl";

/** Options for {@link fakeTilesApi}. */
export interface FakeTilesApiOptions {
  /** How long sessions last. */
  lifetimeS?: number;
  /** HTTP status for tile requests. */
  tileStatus?: number;
  /** Delay before responding to a viewport request, by zoom. */
  viewportDelayMs?: (zoom: string) => number;
}

/**
 * A fake Map Tiles API. Sessions are numbered ("session-1", ...); the
 * viewport copyright names the session and zoom; tiles return a few bytes.
 * Returns a fetch implementation for {@link mockTilesApi}.
 */
export function fakeTilesApi({
  lifetimeS = 14 * 24 * 60 * 60,
  tileStatus = 200,
  viewportDelayMs = () => 0,
}: FakeTilesApiOptions = {}) {
  let sessions = 0;
  return async (input: string): Promise<Response> => {
    const url = new URL(input);
    if (url.pathname === "/v1/createSession") {
      sessions++;
      return Response.json({
        session: `session-${sessions}`,
        expiry: String(Math.floor(Date.now() / 1000) + lifetimeS),
        tileWidth: 256,
        tileHeight: 256,
        imageFormat: "png",
      });
    }
    if (url.pathname === "/tile/v1/viewport") {
      const zoom = url.searchParams.get("zoom") ?? "";
      await new Promise((r) => setTimeout(r, viewportDelayMs(zoom)));
      return Response.json({
        copyright: `© ${url.searchParams.get("session")} z${zoom}`,
        maxZoomRects: [],
      });
    }
    if (url.pathname.startsWith("/v1/2dtiles/")) {
      if (tileStatus !== 200) {
        return new Response("", {
          status: tileStatus,
          statusText: "Not Found",
        });
      }
      return new Response(new Uint8Array([1, 2, 3]), {
        headers: { "cache-control": "max-age=60" },
      });
    }
    return new Response("not found", { status: 404 });
  };
}

/**
 * Replaces fetch with {@link fakeTilesApi}. The cast is needed because Bun's
 * fetch type also requires `preconnect`.
 */
export function mockTilesApi(options: FakeTilesApiOptions = {}) {
  return spyOn(globalThis, "fetch").mockImplementation(
    fakeTilesApi(options) as unknown as typeof fetch,
  );
}

/** Installs a minimal `document` so controls can create elements. */
export function fakeDocument() {
  globalThis.document = {
    createElement: () => ({
      style: {} as Record<string, string>,
      className: "",
      appendChild() {},
      remove() {},
    }),
  } as unknown as Document;
}

interface FakeSource {
  type: string;
  tiles?: string[];
  attribution?: string;
}

interface FakeLayer {
  id: string;
  type: string;
  source?: string;
  layout?: { visibility?: string };
}

/**
 * Just enough of a MapLibre map for the controls: events, a style made of
 * sources and layers, sources with attribution, bounds and zoom.
 */
export class FakeMap {
  sources: Record<string, FakeSource> = {};
  layers: FakeLayer[] = [];
  zoom = 3.4;
  fired: { type: string; data?: unknown }[] = [];
  private listeners: Record<string, Set<() => void>> = {};

  on(type: string, fn: () => void) {
    this.listeners[type] ??= new Set();
    this.listeners[type].add(fn);
    return this;
  }
  off(type: string, fn: () => void) {
    this.listeners[type]?.delete(fn);
    return this;
  }
  fire(type: string, data?: unknown) {
    this.fired.push({ type, data });
    for (const fn of this.listeners[type] ?? []) fn();
    return this;
  }
  listenerCount(type: string) {
    return this.listeners[type]?.size ?? 0;
  }

  getStyle() {
    return {
      version: 8,
      sources: structuredClone(
        Object.fromEntries(
          Object.entries(this.sources).map(([id, { type, tiles }]) => [
            id,
            { type, tiles },
          ]),
        ),
      ),
      layers: structuredClone(this.layers),
    };
  }
  getSource(id: string) {
    return this.sources[id];
  }
  getBounds() {
    return {
      getNorth: () => 41,
      getSouth: () => 40,
      getEast: () => -73,
      getWest: () => -74,
    };
  }
  getZoom() {
    return this.zoom;
  }

  addLayer(layer: FakeLayer) {
    this.layers.push(layer);
    this.fire("styledata");
  }
  controls: { onAdd(map: Map): unknown; onRemove(map: Map): void }[] = [];
  addControl(control: { onAdd(map: Map): unknown; onRemove(map: Map): void }) {
    this.controls.push(control);
    control.onAdd(this.asMap());
    return this;
  }
  removeControl(control: { onRemove(map: Map): void }) {
    this.controls = this.controls.filter((c) => c !== control);
    control.onRemove(this.asMap());
    return this;
  }

  asMap(): Map {
    return this as unknown as Map;
  }
}

/** Lets pending promise callbacks (fetches, refreshes) run. */
export async function settle() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
}
