export const API_BASE_URL = "https://tile.googleapis.com";

export interface ZoomRectangle {
  maxZoom: number;
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface ViewportResponse {
  copyright: string;
  maxZoomRects: Array<ZoomRectangle>;
}

export enum MapType {
  Roadmap = "roadmap",
  Satellite = "satellite",
  Terrain = "terrain",
  Streetview = "streetview",
}

export interface SessionOptions {
  mapType: MapType | `${MapType}`;
  language: string;
  region: string;
  imageFormat?: string;
  scale?: string;
  highDpi?: boolean;
  layerTypes?: Array<string>;
  styles?: Array<unknown>;
  overlay?: boolean;
  apiOptions?: Array<string>;
}

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
