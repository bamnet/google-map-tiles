import type { LatLngBounds } from "./tiles.ts";

/**
 * A tile in the 2D tile grid: at zoom `z` the world is `2^z` tiles across and
 * down, with `x` counting east from the antimeridian and `y` counting south
 * from the top of the map.
 */
export interface TileCoord {
  z: number;
  x: number;
  y: number;
}

/** A point, in degrees. */
export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * The northernmost latitude 2D tiles cover; the southernmost is its negative.
 * Web Mercator can't show the poles.
 */
export const MAX_LATITUDE = 85.0511287798066;

function checkZoom(zoom: number) {
  if (!Number.isInteger(zoom) || zoom < 0) {
    throw new RangeError(`Zoom must be a whole number of 0 or more: ${zoom}`);
  }
}

/**
 * The tile that contains a point at a zoom level. Latitudes beyond
 * {@link MAX_LATITUDE} give the top or bottom row, and longitudes wrap around.
 *
 * @example
 * ```ts
 * const { z, x, y } = tileAt({ lat: 40.7128, lng: -74.006 }, 12);
 * const url = client.tileUrl(z, x, y);
 * ```
 * @throws {RangeError} If the zoom isn't a whole number of 0 or more
 */
export function tileAt({ lat, lng }: LatLng, zoom: number): TileCoord {
  checkZoom(zoom);
  const n = 2 ** zoom;
  const wrapped = ((((lng + 180) % 360) + 360) % 360) / 360;
  const clamped = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, lat));
  const latRad = (clamped * Math.PI) / 180;
  const row = (1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2;
  return {
    z: zoom,
    x: Math.min(n - 1, Math.floor(wrapped * n)),
    y: Math.max(0, Math.min(n - 1, Math.floor(row * n))),
  };
}

/**
 * The area a tile covers, e.g. to get attribution for the tiles you show
 * with `getViewport()`.
 *
 * @example
 * ```ts
 * // Attribution for a 3×3 block of tiles starting at (x, y).
 * const { north, west } = tileBounds(z, x, y);
 * const { south, east } = tileBounds(z, x + 2, y + 2);
 * const { copyright } = await client.getViewport(z, { north, south, east, west });
 * ```
 * @throws {RangeError} If the zoom isn't a whole number of 0 or more, or the
 *   tile is outside the grid
 */
export function tileBounds(z: number, x: number, y: number): LatLngBounds {
  checkZoom(z);
  const n = 2 ** z;
  for (const [name, value] of [
    ["x", x],
    ["y", y],
  ] as const) {
    if (!Number.isInteger(value) || value < 0 || value >= n) {
      throw new RangeError(
        `Tile ${name} must be a whole number from 0 to ${n - 1} at zoom ${z}: ${value}`,
      );
    }
  }
  const lng = (column: number) => (column / n) * 360 - 180;
  const lat = (row: number) =>
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * row) / n))) * 180) / Math.PI;
  return { north: lat(y), south: lat(y + 1), east: lng(x + 1), west: lng(x) };
}
