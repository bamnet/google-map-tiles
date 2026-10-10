export const API_BASE_URL = "https://tile.googleapis.com";

/**
 * Defines a rectangular region and the maximum zoom level at which
 * data is available in that region.
 */
export interface ZoomRectangle {
  maxZoom: number;
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * Contains copyright information and maximum zoom level data for a given viewport.
 */
export interface ViewportResponse {
  copyright: string;
  maxZoomRects: Array<ZoomRectangle>;
}

/**
 * Represents the available map types for requesting tiles.
 */
export enum MapType {
  /** Standard Google Maps roadmap tiles. */
  Roadmap = "roadmap",
  /** Satellite imagery tiles. */
  Satellite = "satellite",
  /**
   * Terrain tiles with relief information. Requires the
   * {@link LayerType.Roadmap} layer type.
   */
  Terrain = "terrain",
}

/**
 * Represents the available layer types for requesting tiles.
 */
export enum LayerType {
  /**
   * Road names and outlines. Required with {@link MapType.Terrain}, optional
   * with {@link MapType.Satellite}, and no effect on {@link MapType.Roadmap}.
   */
  Roadmap = "layerRoadmap",
  /** Outline areas where Street View is available. */
  StreetView = "layerStreetview",
  /** Display current traffic. */
  Traffic = "layerTraffic",
}

/**
 * Represents the available label scales for tiles.
 */
export enum Scale {
  /** Standard label size. The default. */
  Factor1x = "scaleFactor1x",
  /** Doubles label size and removes minor feature labels. */
  Factor2x = "scaleFactor2x",
  /** Quadruples label size and removes minor feature labels. */
  Factor4x = "scaleFactor4x",
}

/**
 * Represents the available tile image formats.
 */
export enum ImageFormat {
  /** PNG, which supports transparency. */
  Png = "png",
  /** JPEG. Not recommended for overlays, since it has no transparency. */
  Jpeg = "jpeg",
}

/**
 * Configuration options used when creating a new Tile API session.
 * @see https://developers.google.com/maps/documentation/tile/session_tokens
 */
export interface SessionOptions {
  /** The type of map tiles to request (e.g., roadmap, satellite). */
  mapType: MapType | `${MapType}`;
  /** An IETF language tag for labels on the map tiles (e.g., "en-US"). */
  language: string;
  /** A CLDR region identifier for the user's location (e.g., "US"). */
  region: string;
  /**
   * The image format for the tiles. Chosen automatically if omitted.
   */
  imageFormat?: ImageFormat | `${ImageFormat}`;
  /**
   * The label scale for the tiles.
   * @default "scaleFactor1x"
   */
  scale?: Scale | `${Scale}`;
  /**
   * Whether to return high-resolution tiles. Only has an effect with a
   * {@link Scale.Factor2x} or {@link Scale.Factor4x} scale.
   */
  highDpi?: boolean;
  /**
   * Layers to add to the map. {@link MapType.Terrain} requires
   * {@link LayerType.Roadmap}.
   */
  layerTypes?: Array<LayerType | `${LayerType}`>;
  /** Style objects for map features. Only valid with {@link MapType.Roadmap}. */
  styles?: Array<unknown>;
  /**
   * Whether to render `layerTypes` as a separate overlay, without the base
   * map. Ignored if no `layerTypes` are given.
   */
  overlay?: boolean;
  /**
   * An array of values specifying additional options to apply.
   */
  apiOptions?: Array<string>;
}

/**
 * Contains the details of an active map session, returned by `createSession`.
 * This information is needed for subsequent tile and viewport requests.
 */
export interface SessionResponse {
  session: string;
  /** Expiration time, in seconds since the epoch (e.g. "1792807483"). */
  expiry: string;
  tileWidth: number;
  tileHeight: number;
  imageFormat: string;
}

/** Options for constructing a {@link GoogleMapTiles} client. */
export interface ClientOptions {
  /**
   * Base URL for API and tile requests.
   * @default "https://tile.googleapis.com"
   */
  baseUrl?: string;
}

/** How long before expiry {@link GoogleMapTiles.isExpiring} reports true. */
const DEFAULT_EXPIRY_MARGIN_MS = 60 * 60 * 1000;

/**
 * Client for the Google Maps Tiles API v1.
 * Manages sessions and provides methods to fetch map tiles and viewport information.
 *
 * Has no dependency on MapLibre and runs anywhere `fetch` is available.
 */
export class GoogleMapTiles {
  apiKey: string;
  session: SessionResponse | null = null;

  private lastOptions: SessionOptions | null = null;
  private readonly baseUrl: string;

  /**
   * Creates a new GoogleMapTiles client.
   * @param apiKey Google Maps API key
   * @param options Optional client configuration
   */
  constructor(apiKey: string, options: ClientOptions = {}) {
    this.apiKey = apiKey;
    this.baseUrl = options.baseUrl ?? API_BASE_URL;
  }

  /**
   * Creates a new map session with the specified parameters.
   * @param request The session configuration
   * @returns Session details including token and expiry
   * @throws {Error} If the session creation fails
   */
  async createSession(request: SessionOptions): Promise<SessionResponse> {
    const url = `${this.baseUrl}/v1/createSession?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    const data = await response.json();
    if (!response.ok) {
      // Try to get the detailed error message from the Google Maps API error format
      const errorMessage = data.error?.message || response.statusText;
      throw new Error(`Error creating session: ${errorMessage}`);
    }

    this.session = data as SessionResponse;
    this.lastOptions = request;
    return this.session;
  }

  /**
   * Creates a new session using the options from the last
   * {@link createSession} call.
   * @throws {Error} If no session has been created yet, or the request fails
   */
  async refreshSession(): Promise<SessionResponse> {
    if (!this.lastOptions) {
      throw new Error("Session not created. Call createSession() first.");
    }
    return await this.createSession(this.lastOptions);
  }

  /** The options the current session was created with, if any. */
  get sessionOptions(): Readonly<SessionOptions> | null {
    return this.lastOptions;
  }

  /**
   * The time the current session expires, or null if there is no session.
   */
  expiresAt(): Date | null {
    if (!this.session) {
      return null;
    }
    return new Date(Number(this.session.expiry) * 1000);
  }

  /**
   * Whether the session is missing, expired, or expires within `marginMs`.
   * @param marginMs How far ahead of expiry to report true (default: 1 hour)
   */
  isExpiring(marginMs: number = DEFAULT_EXPIRY_MARGIN_MS): boolean {
    const expiresAt = this.expiresAt();
    return !expiresAt || expiresAt.getTime() - Date.now() <= marginMs;
  }

  /**
   * Gets viewport information for the specified geographic bounds.
   * @param zoom Zoom level
   * @param north Northern latitude bound
   * @param south Southern latitude bound
   * @param east Eastern longitude bound
   * @param west Western longitude bound
   * @returns Viewport details including copyright and zoom rectangles
   * @throws {Error} If no session exists or the request fails
   */
  async getViewport(
    zoom: number,
    north: number,
    south: number,
    east: number,
    west: number,
  ): Promise<ViewportResponse> {
    if (!this.session) {
      throw new Error("Session not created. Call createSession() first.");
    }

    const url = `${this.baseUrl}/tile/v1/viewport?session=${this.session.session}&key=${this.apiKey}&zoom=${zoom}&north=${north}&south=${south}&east=${east}&west=${west}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Error fetching viewport: ${response.statusText}`);
    }

    return (await response.json()) as ViewportResponse;
  }

  /**
   * Generates a tile URL template with `{z}`, `{x}` and `{y}` placeholders,
   * suitable for the `tiles` array of a MapLibre raster source.
   * @throws {Error} If no session exists
   */
  tileUrlTemplate(): string {
    if (!this.session) {
      throw new Error("Session not created. Call createSession() first.");
    }

    return `${this.baseUrl}/v1/2dtiles/{z}/{x}/{y}?session=${this.session.session}&key=${this.apiKey}`;
  }

  /**
   * Generates a URL for fetching a specific map tile.
   * @param z Zoom level
   * @param x Tile X coordinate
   * @param y Tile Y coordinate
   * @param orientation Tile orientation in degrees. Omitted unless given:
   *   the API rejects satellite tiles with any orientation parameter.
   * @returns URL to fetch the tile image
   * @throws {Error} If no session exists
   */
  tileUrl(z: number, x: number, y: number, orientation?: number): string {
    if (!this.session) {
      throw new Error("Session not created. Call createSession() first.");
    }

    const url = `${this.baseUrl}/v1/2dtiles/${z}/${x}/${y}?session=${this.session.session}&key=${this.apiKey}`;
    return orientation === undefined
      ? url
      : `${url}&orientation=${orientation}`;
  }
}
