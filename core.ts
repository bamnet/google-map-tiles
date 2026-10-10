/**
 * The MapLibre-independent core: the Tile API client, a session pool,
 * helpers that build plain MapLibre source and style JSON, and the Google Maps
 * logo. Runs anywhere `fetch` is available,
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

export { SessionPool, sessionKey } from "./src/session_pool.ts";
export type { SessionPoolOptions } from "./src/session_pool.ts";

export { GOOGLE_MAPS_LOGO } from "./src/google_logo.ts";
export type {
  GoogleMapsLogo,
  LogoImage,
  LogoVariant,
} from "./src/google_logo.ts";

export {
  createGoogleSource,
  createGoogleStyle,
  TILE_SIZE,
} from "./src/maplibre_style.ts";
export type {
  GoogleSource,
  RasterLayer,
  RasterSource,
  SourceOptions,
  Style,
  StyleOptions,
} from "./src/maplibre_style.ts";
