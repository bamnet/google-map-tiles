import {
  type ClientOptions,
  GoogleMapTiles,
  type SessionOptions,
  type SessionResponse,
} from "./tiles.ts";

/**
 * Attribution used until a viewport-specific attribution is fetched, and when
 * the API returns none. Google's policies ask new integrations to use
 * "Google Maps" rather than "Google":
 * https://developers.google.com/maps/documentation/tile/policies
 */
export const DEFAULT_ATTRIBUTION = "Google Maps";

/**
 * Tile size, in CSS pixels, for Google 2D tiles. Tiles use the standard
 * 256px Web Mercator grid; high-DPI sessions return 512px images for the
 * same tiles, which MapLibre renders at this size.
 */
export const TILE_SIZE = 256;

/**
 * A MapLibre raster source. Structurally compatible with MapLibre's
 * `RasterSourceSpecification`, without depending on maplibre-gl.
 */
export interface RasterSource {
  type: "raster";
  tiles: string[];
  tileSize: number;
  attribution?: string;
}

/** A raster layer. Structurally compatible with MapLibre's `RasterLayerSpecification`. */
export interface RasterLayer {
  id: string;
  type: "raster";
  source: string;
}

/**
 * A MapLibre style containing Google tiles. Structurally compatible with
 * MapLibre's `StyleSpecification`.
 */
export interface Style {
  version: 8;
  sources: Record<string, RasterSource>;
  layers: RasterLayer[];
}

/** Options for {@link createGoogleSource}. */
export interface SourceOptions extends ClientOptions {
  /**
   * Initial attribution text for the source.
   * @default DEFAULT_ATTRIBUTION
   */
  attribution?: string;
}

/** Options for {@link createGoogleStyle}. */
export interface StyleOptions extends SourceOptions {
  /** @default "google-map-tiles" */
  sourceId?: string;
  /** @default "google-map-tiles" */
  layerId?: string;
}

/** A Google tile source together with the session that backs it. */
export interface GoogleSource {
  /** A plain MapLibre raster source: pass to `map.addSource()` or embed in a style. */
  source: RasterSource;
  session: SessionResponse;
  /** When the session, and therefore the tile URLs, stop working. */
  expiresAt: Date;
}

/**
 * Creates a Tile API session and returns a MapLibre raster source for it.
 *
 * The result is plain JSON, so it can be built on a server and sent to any
 * MapLibre client. Its tile URLs contain the API key and stop working at
 * `expiresAt`; create a new source before then.
 */
export async function createGoogleSource(
  apiKey: string,
  options: SessionOptions,
  sourceOptions: SourceOptions = {},
): Promise<GoogleSource> {
  const client = new GoogleMapTiles(apiKey, sourceOptions);
  const session = await client.createSession(options);
  return {
    source: {
      type: "raster",
      tiles: [client.tileUrlTemplate()],
      tileSize: TILE_SIZE,
      attribution: sourceOptions.attribution ?? DEFAULT_ATTRIBUTION,
    },
    session,
    expiresAt: client.expiresAt() as Date,
  };
}

/**
 * Creates a complete MapLibre style containing a single Google tile layer.
 *
 * Useful for serving a style URL to clients that load styles by URL, such as
 * MapLibre Native or Flutter apps. Like {@link createGoogleSource}, the style
 * stops working at `expiresAt`.
 */
export async function createGoogleStyle(
  apiKey: string,
  options: SessionOptions,
  styleOptions: StyleOptions = {},
): Promise<{ style: Style; expiresAt: Date }> {
  const sourceId = styleOptions.sourceId ?? "google-map-tiles";
  const layerId = styleOptions.layerId ?? "google-map-tiles";
  const { source, expiresAt } = await createGoogleSource(
    apiKey,
    options,
    styleOptions,
  );
  return {
    style: {
      version: 8,
      sources: { [sourceId]: source },
      layers: [{ id: layerId, type: "raster", source: sourceId }],
    },
    expiresAt,
  };
}
