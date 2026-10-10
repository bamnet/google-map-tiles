import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { compactSvg, renderLogoModule } from "../scripts/generate_logo.ts";
import { createGoogleLogo, GOOGLE_MAPS_LOGO } from "./google_logo.ts";
import { fakeDocument } from "./test_helpers.ts";

const ASSETS = new URL("../assets/google-maps-logo/", import.meta.url);

beforeEach(fakeDocument);
afterEach(() => {
  mock.restore();
});

/** Path data, colors and other attributes, with whitespace normalized. */
function drawing(svg: string) {
  return [...svg.matchAll(/\s([a-zA-Z:-]+)="([^"]*)"/g)].map(
    ([, name, value]) => `${name}=${value.replace(/\s+/g, " ").trim()}`,
  );
}

test("google_logo_data.ts is up to date with the assets", async () => {
  const committed = await Bun.file(
    new URL("./google_logo_data.ts", import.meta.url),
  ).text();
  // If this fails, run `bun run generate:logo`.
  expect(committed).toBe(await renderLogoModule());
});

test("compactSvg leaves the logo itself unchanged", async () => {
  for (const file of [
    "GoogleMaps_Logo_WithLightOutline.svg",
    "GoogleMaps_Logo_WithDarkOutline.svg",
  ]) {
    const raw = await Bun.file(new URL(file, ASSETS)).text();
    // Only the XML declaration and comments are expected to go.
    const original = raw
      .replace(/<\?xml[^>]*\?>/, "")
      .replace(/<!--[\s\S]*?-->/g, "");
    const compact = compactSvg(raw);

    expect(drawing(compact)).toEqual(drawing(original));
    expect(compact.match(/<[a-z]+/g)).toEqual(original.match(/<[a-z]+/g));
    expect(compact).not.toContain("<?xml");
    expect(compact).not.toContain("<!--");
  }
});

test("GOOGLE_MAPS_LOGO - data URIs decode to the SVGs", () => {
  for (const variant of ["light", "dark"] as const) {
    const { svg, dataUri } = GOOGLE_MAPS_LOGO[variant];
    expect(dataUri.startsWith("data:image/svg+xml,")).toBe(true);
    expect(decodeURIComponent(dataUri.slice(dataUri.indexOf(",") + 1))).toBe(
      svg,
    );
    expect(svg).toStartWith("<svg");
    expect(svg).toContain('viewBox="0 0 105 22"');
  }
  // Light: dark gray text. Dark: white text on a dark outline.
  expect(GOOGLE_MAPS_LOGO.light.svg).toContain("#474747");
  expect(GOOGLE_MAPS_LOGO.dark.svg).toContain("#1E1E1E");
});

test("createGoogleLogo - sized and spaced per Google's requirements", () => {
  const img = createGoogleLogo("dark");

  expect(img.src).toBe(GOOGLE_MAPS_LOGO.dark.dataUri);
  expect(img.alt).toBe("Google Maps");
  expect(img.height).toBeGreaterThanOrEqual(GOOGLE_MAPS_LOGO.minHeight);
  expect(img.height).toBeLessThanOrEqual(GOOGLE_MAPS_LOGO.maxHeight);
  expect(img.width / img.height).toBeCloseTo(105 / 22, 1);
  expect(img.style.margin).toBe("10px 10px 5px 10px");
});
