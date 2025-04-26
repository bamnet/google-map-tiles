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
  /** Terrain tiles with relief information. */
  Terrain = "terrain",
  /** Street View panorama tiles (requires additional parameters not fully supported by this basic type). */
  Streetview = "streetview",
}

/**
 * Configuration options used when creating a new Tile API session.
 */
export interface SessionOptions {
  /** The type of map tiles to request (e.g., roadmap, satellite). */
  mapType: MapType | `${MapType}`;
  /** The language to use for labels on the map tiles (e.g., "en-US"). */
  language: string;
  /** The region code (CLDR identifier) to tailor map details (e.g., "US"). */
  region: string;
  /**
   * The image format for the tiles (e.g., "png", "jpeg").
   */
  imageFormat?: string;
  /**
   * The scale factor for the tiles. Use "scaleFactor2x" for high-DPI devices.
   * @default "scaleFactor1x"
   */
  scale?: string;
  highDpi?: boolean;
  layerTypes?: Array<string>;
  styles?: Array<unknown>;
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
  expiry: string;
  tileWidth: number;
  tileHeight: number;
  imageFormat: string;
}

/**
 * Client for the Google Maps Tiles API v1.
 * Manages sessions and provides methods to fetch map tiles and viewport information.
 */
export class GoogleMapTiles {
  apiKey: string;
  session: SessionResponse | null = null;

  /**
   * Creates a new GoogleMapTiles client.
   * @param apiKey Google Maps API key
   */
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Creates a new map session with the specified parameters.
   * @param request The session configuration
   * @returns Session details including token and expiry
   * @throws {Error} If the session creation fails
   */
  async createSession(request: SessionOptions): Promise<SessionResponse> {
    const url = `${API_BASE_URL}/v1/createSession?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Error creating session: ${response.statusText}`);
    }

    this.session = await response.json() as SessionResponse;
    return this.session;
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

    const url =
      `${API_BASE_URL}/tile/v1/viewport?session=${this.session.session}&key=${this.apiKey}&zoom=${zoom}&north=${north}&south=${south}&east=${east}&west=${west}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Error fetching viewport: ${response.statusText}`);
    }

    return await response.json() as ViewportResponse;
  }

  /**
   * Generates a TileJSON URL for fetching tiles.
   */
  tileJSONUrl(): string {
    if (!this.session) {
      throw new Error("Session not created. Call createSession() first.");
    }

    return `${API_BASE_URL}/v1/2dtiles/{z}/{x}/{y}?session=${this.session.session}&key=${this.apiKey}`;
  }

  /**
   * Generates a URL for fetching a specific map tile.
   * @param z Zoom level
   * @param x Tile X coordinate
   * @param y Tile Y coordinate
   * @param orientation Tile orientation in degrees (default: 0)
   * @returns URL to fetch the tile image
   * @throws {Error} If no session exists
   */
  tileUrl(z: number, x: number, y: number, orientation: number = 0): string {
    if (!this.session) {
      throw new Error("Session not created. Call createSession() first.");
    }

    return `${API_BASE_URL}/v1/2dtiles/${z}/${x}/${y}?session=${this.session.session}&key=${this.apiKey}&orientation=${orientation}`;
  }
}
