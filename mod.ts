/**
 * Google Map Tiles for MapLibre GL JS. Includes everything from
 * `@bamnet/google-map-tiles/core` plus the MapLibre integration.
 *
 * @module
 */
export * from "./core.ts";

export {
  addGoogleMapTiles,
  GoogleMapTilesSourceManager,
} from "./src/maplibre_plugin.ts";

export { addGoogleLogo, GoogleLogoControl } from "./src/logo_control.ts";
