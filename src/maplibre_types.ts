// The parts of MapLibre GL JS this library uses, described structurally, so
// the package doesn't depend on maplibre-gl: apps pass their own maplibre-gl
// objects, and `/core` users don't install it at all.
//
// src/maplibre_types_test.ts checks these against maplibre-gl's own types.
// If maplibre-gl changes in a way that breaks them, that check fails.

/**
 * The parts of a MapLibre GL JS `Map` that {@link GoogleMapsControl} uses.
 * Any maplibre-gl `Map` satisfies it.
 */
export interface MapLike {
  on(type: string, listener: () => void): unknown;
  off(type: string, listener: () => void): unknown;
  fire(type: string, properties?: object): unknown;
  getZoom(): number;
  getBounds(): {
    getNorth(): number;
    getSouth(): number;
    getEast(): number;
    getWest(): number;
  };
  getStyle(): MapStyleLike | undefined;
  getSource(id: string): { attribution?: string } | undefined;
}

/** The parts of a MapLibre style that {@link GoogleMapsControl} reads. */
export interface MapStyleLike {
  sources: { [id: string]: { type: string; tiles?: string[] } };
  layers: { source?: string; layout?: { visibility?: unknown } }[];
}

/**
 * The request MapLibre GL JS passes to a protocol handler. Any maplibre-gl
 * `RequestParameters` satisfies it.
 */
export interface ProtocolRequest {
  /** The URL being requested, e.g. `google://roadmap/1/2/3?...`. */
  url: string;
}

/**
 * What a protocol handler returns to MapLibre GL JS: a maplibre-gl
 * `GetResourceResponse`.
 */
export interface ProtocolResponse {
  /** The tile image. */
  data: ArrayBuffer;
  /** The response's `Cache-Control` header, if any. */
  cacheControl: string | null;
  /** The response's `Expires` header, if any. */
  expires: string | null;
}
