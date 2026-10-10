/**
 * Google Map Tiles for MapLibre GL JS. Includes everything from
 * `@bamnet/google-map-tiles/core` plus the MapLibre integration.
 *
 * @module
 */
export * from "./core.ts";

export {
  decodeTileUrl,
  encodeTileUrl,
  GoogleMapTilesProtocol,
} from "./src/maplibre_protocol.ts";
export type { ProtocolOptions } from "./src/maplibre_protocol.ts";

export { GoogleMapsControl } from "./src/google_maps_control.ts";
export type {
  GoogleMapsControlOptions,
  GoogleSourceResolver,
} from "./src/google_maps_control.ts";
export type {
  MapLike,
  MapStyleLike,
  ProtocolRequest,
  ProtocolResponse,
} from "./src/maplibre_types.ts";
