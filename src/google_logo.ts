import { DARK_OUTLINE_SVG, LIGHT_OUTLINE_SVG } from "./google_logo_data.ts";

/** Which outlined logo to show. */
export type LogoVariant = "light" | "dark";

/** One variant of the Google Maps logo. */
export interface LogoImage {
  /** The SVG markup. */
  svg: string;
  /** A `data:` URI of the SVG, usable as an image `src`. */
  dataUri: string;
}

const toDataUri = (svg: string): string =>
  `data:image/svg+xml,${encodeURIComponent(svg)}`;

/** The Google Maps logo, and how Google requires it to be displayed. */
export interface GoogleMapsLogo {
  /** Dark text with a light outline, for light maps such as roadmap. */
  light: LogoImage;
  /** Light text with a dark outline, for dark maps such as satellite. */
  dark: LogoImage;
  /** Intrinsic width, in pixels. Keep the aspect ratio. */
  width: number;
  /** Intrinsic height, in pixels. */
  height: number;
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
 * Use `light` (dark text, light outline) on light maps such as roadmap, and
 * `dark` (light text, dark outline) on dark maps such as satellite imagery.
 * The same files, plus PNGs, are in the package's `assets/google-maps-logo/`.
 *
 * The Google Maps logo is a trademark of Google LLC.
 * @see https://developers.google.com/maps/documentation/tile/policies
 */
export const GOOGLE_MAPS_LOGO: Readonly<GoogleMapsLogo> = {
  light: { svg: LIGHT_OUTLINE_SVG, dataUri: toDataUri(LIGHT_OUTLINE_SVG) },
  dark: { svg: DARK_OUTLINE_SVG, dataUri: toDataUri(DARK_OUTLINE_SVG) },
  width: 105,
  height: 22,
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
  const { clearSpace: s } = GOOGLE_MAPS_LOGO;
  img.src = GOOGLE_MAPS_LOGO[variant].dataUri;
  img.alt = GOOGLE_MAPS_LOGO.alt;
  img.height = DISPLAY_HEIGHT;
  img.width = Math.round(
    (DISPLAY_HEIGHT * GOOGLE_MAPS_LOGO.width) / GOOGLE_MAPS_LOGO.height,
  );
  img.style.display = "block";
  img.style.margin = `${s.top}px ${s.right}px ${s.bottom}px ${s.left}px`;
  return img;
}
