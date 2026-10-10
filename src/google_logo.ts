import {
  DARK_GRAY_SVG,
  DARK_OUTLINE_SVG,
  GRAY_SVG,
  LIGHT_OUTLINE_SVG,
  WHITE_SVG,
} from "./google_logo_data.ts";

/** Which outlined logo to show over a map. */
export type LogoVariant = "light" | "dark";

/** One variant of the Google Maps logo. */
export interface LogoImage {
  /** The SVG markup. */
  svg: string;
  /** A `data:` URI of the SVG, usable as an image `src`. */
  dataUri: string;
  /** Intrinsic width, in pixels. Keep the aspect ratio. */
  width: number;
  /** Intrinsic height, in pixels. */
  height: number;
}

const image = (svg: string, width: number, height: number): LogoImage => ({
  svg,
  dataUri: `data:image/svg+xml,${encodeURIComponent(svg)}`,
  width,
  height,
});

/** The Google Maps logo, and how Google requires it to be displayed. */
export interface GoogleMapsLogo {
  /** Outlined, with dark text: over light maps, such as roadmap. */
  light: LogoImage;
  /** Outlined, with light text: over dark maps, such as satellite. */
  dark: LogoImage;
  /** Not outlined, gray: on plain light backgrounds. */
  gray: LogoImage;
  /** Not outlined, dark gray: on plain light backgrounds. */
  darkGray: LogoImage;
  /** Not outlined, white: on plain dark backgrounds. */
  white: LogoImage;
  /** Smallest allowed display height, in CSS pixels. */
  minHeight: number;
  /** Largest allowed display height, in CSS pixels. */
  maxHeight: number;
  /** Minimum clear space around the logo, in CSS pixels. */
  clearSpace: { top: number; right: number; bottom: number; left: number };
  /** Accessible label. */
  alt: string;
}

/**
 * The Google Maps logo and how Google requires it to be displayed, for apps
 * that show it themselves. `GoogleMapsControl` shows it automatically.
 *
 * Google's policies call for the outlined logo on a busy background, such as
 * over the map, and the non-outlined logo on a plain background, such as a
 * solid color next to the map:
 * - Over the map: `light` (dark text) on light maps such as roadmap, and
 *   `dark` (light text) on dark maps such as satellite imagery.
 * - On a plain background: `gray` or `darkGray` on light colors, and `white`
 *   on dark colors. Choose one with accessible contrast.
 *
 * The same files, plus PNGs, are in the package's `assets/google-maps-logo/`.
 *
 * The Google Maps logo is a trademark of Google LLC.
 * @see https://developers.google.com/maps/documentation/tile/policies
 */
export const GOOGLE_MAPS_LOGO: Readonly<GoogleMapsLogo> = {
  light: image(LIGHT_OUTLINE_SVG, 105, 22),
  dark: image(DARK_OUTLINE_SVG, 105, 22),
  gray: image(GRAY_SVG, 98, 18),
  darkGray: image(DARK_GRAY_SVG, 98, 18),
  white: image(WHITE_SVG, 98, 18),
  minHeight: 16,
  maxHeight: 19,
  clearSpace: { top: 10, right: 10, bottom: 5, left: 10 },
  alt: "Google Maps",
};

/** Display height used by `GoogleMapsControl`, within Google's 16–19px. */
const DISPLAY_HEIGHT = 18;

/**
 * Creates the Google Maps logo image shown by `GoogleMapsControl`, sized and
 * spaced as Google requires.
 */
export function createGoogleLogo(variant: LogoVariant): HTMLImageElement {
  const img = document.createElement("img");
  const logo = GOOGLE_MAPS_LOGO[variant];
  const { clearSpace: s } = GOOGLE_MAPS_LOGO;
  img.src = logo.dataUri;
  img.alt = GOOGLE_MAPS_LOGO.alt;
  img.height = DISPLAY_HEIGHT;
  img.width = Math.round((DISPLAY_HEIGHT * logo.width) / logo.height);
  img.style.display = "block";
  img.style.margin = `${s.top}px ${s.right}px ${s.bottom}px ${s.left}px`;
  return img;
}
