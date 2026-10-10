/**
 * The MapLibre-independent core: the Tile API client and helpers that build
 * plain MapLibre source and style JSON. Runs anywhere `fetch` is available,
 * including servers, and does not require maplibre-gl.
 *
 * @module
 */
export {
  API_BASE_URL,
  GoogleMapTiles,
  LayerType,
  MapType,
} from "./src/tiles.ts";
export type {
  ClientOptions,
  SessionOptions,
  SessionResponse,
  ViewportResponse,
  ZoomRectangle,
} from "./src/tiles.ts";

export {
  createGoogleSource,
  createGoogleStyle,
  TILE_SIZE,
} from "./src/source.ts";
export type {
  GoogleSource,
  RasterLayer,
  RasterSource,
  SourceOptions,
  Style,
  StyleOptions,
} from "./src/source.ts";
