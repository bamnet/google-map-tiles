# 🗺️ Google Map Tiles

A TypeScript library for the
[Google Map Tiles API](https://developers.google.com/maps/documentation/tile).
It lets MapLibre GL JS use Google tiles as ordinary style sources, with
attribution and the Google Maps logo handled for you. Its dependency-free core also builds MapLibre
styles for MapLibre Native and Flutter, and works with no map library at all.

Demo @ https://bamnet.github.io/google-map-tiles/

[![Build](https://github.com/bamnet/google-map-tiles/actions/workflows/ci.yaml/badge.svg)](https://github.com/bamnet/google-map-tiles/actions/workflows/ci.yaml)
[![JSR](https://jsr.io/badges/@bamnet/google-map-tiles)](https://jsr.io/@bamnet/google-map-tiles)

## ✨ Features

- 🌍 Easy integration with MapLibre GL JS
- 📐 MapLibre styles for MapLibre Native, Flutter and servers
- 🧩 A dependency-free API client for any other renderer
- 🗺️ Support for different map types (roadmap, satellite, terrain)
- 🌐 Customizable language and region settings
- 🔄 Automatic session management
- ©️ Dynamic attribution handling
- 🎯 Google Maps logo placement
- 📝 TypeScript support

## 📦 Installation

```bash
# Using Bun
bunx jsr add @bamnet/google-map-tiles

# Using Deno
deno add jsr:@bamnet/google-map-tiles

# Using NPM
npx jsr add @bamnet/google-map-tiles

# Using Yarn
yarn add jsr:@bamnet/google-map-tiles
```

## 🧭 Choosing an Entry Point

The library supports three ways of using Google Map Tiles:

| You're using | Import | What you get |
|---|---|---|
| MapLibre GL JS | `@bamnet/google-map-tiles` | Tiles, attribution and logo, handled for you |
| A MapLibre style, but not MapLibre GL JS (MapLibre Native, Flutter, or a server that builds styles) | `@bamnet/google-map-tiles/core` | A ready-made MapLibre source or style |
| No MapLibre (your own `<img>` grid, canvas, Leaflet, OpenLayers, ...) | `@bamnet/google-map-tiles/core` | Sessions, tile URLs and attribution text |

The package has no dependencies. `@bamnet/google-map-tiles/core` runs anywhere
`fetch` is available: browsers, Node, Bun, Deno and edge runtimes. The main
entry point includes everything in `/core`, and works with the `maplibre-gl`
your app installs, version 6.4.1 or later.

## 🗺️ With MapLibre GL JS

Register the `GoogleMapTilesProtocol` with MapLibre, then use Google tiles in
your style like any other source:

```typescript
import { addProtocol, Map } from "maplibre-gl";
import { GoogleMapTilesProtocol } from "@bamnet/google-map-tiles";

const google = new GoogleMapTilesProtocol("YOUR_API_KEY");
addProtocol("google", google.handler);

const map = new Map({
  container: "map",
  style: {
    version: 8,
    sources: {
      google: google.source({
        mapType: "roadmap",
        language: "en-US",
        region: "us",
      }),
    },
    layers: [{ id: "google", type: "raster", source: "google" }],
  },
});

// The Google Maps logo, and attribution for every Google source in the style
map.addControl(google.control());
```

Google sources work like any other source: they survive `setStyle()`, can sit
under labels or other layers, and a style can use several. To change options,
change the source, for example with `setStyle()`.

Sources look like `google://roadmap/{z}/{x}/{y}?language=en-US&region=us` and
don't contain your API key. Sessions are created when tiles are first needed,
shared between sources with the same options, and replaced before they expire.

A bad API key or invalid options show up as tile errors once the map loads. To
catch them up front, validate the options first. The session is then reused
for tiles:

```typescript
try {
  await google.validate({ mapType: "roadmap", language: "en-US", region: "us" });
} catch (error) {
  // e.g. "Error creating session: 400 API key not valid. Please pass a valid API key."
}
```

## 📐 With a MapLibre Style (MapLibre Native, Flutter, servers)

Any MapLibre renderer can load a style. Build one, for example on a server, and
hand it to MapLibre Native, Flutter or any client that loads styles by URL:

```typescript
import { createGoogleStyle } from "@bamnet/google-map-tiles/core";

const { style, expiresAt } = await createGoogleStyle("YOUR_API_KEY", {
  mapType: "roadmap",
  language: "en-US",
  region: "us",
});
// Serve `style` as JSON.
```

Or create just a source to add to an existing style:

```typescript
import { createGoogleSource } from "@bamnet/google-map-tiles/core";

const { source, expiresAt } = await createGoogleSource("YOUR_API_KEY", {
  mapType: "satellite",
  language: "en-US",
  region: "us",
});
map.addSource("google", source);
map.addLayer({ id: "google", type: "raster", source: "google" });
```

In this mode, your app is responsible for:

- **Refreshing:** tile URLs stop working at `expiresAt` (currently about two
  weeks after creation). Create a new style or source before then.
- **Attribution:** see the Attribution section below. Pass the current
  text as `attribution`, or display it yourself.

## 🧩 Without MapLibre

Use a `SessionPool` to get a client with a current session for each set of
options, then build tile URLs and fetch attribution for whatever draws your
map:

```typescript
import { SessionPool, tileAt, tileBounds } from "@bamnet/google-map-tiles/core";

const pool = new SessionPool("YOUR_API_KEY");

// The first call creates a session; later calls with the same options reuse
// it, and it's replaced automatically shortly before it expires.
const client = await pool.client({
  mapType: "roadmap",
  language: "en-US",
  region: "us",
});

// The tile containing a point, e.g. for an <img>
const { z, x, y } = tileAt({ lat: 40.7128, lng: -74.006 }, 15);
const url = client.tileUrl(z, x, y);

// Or a {z}/{x}/{y} template, for libraries that take one
const template = client.tileUrlTemplate();

// Attribution for what's shown: here, the area that tile covers
const { copyright } = await client.getViewport(z, tileBounds(z, x, y));
```

Call `pool.client()` whenever you need tiles rather than keeping the client,
so you always get a current session. Concurrent calls share one request, and a
failed request isn't cached, so the next call retries.

To manage a single session yourself, use `GoogleMapTiles` directly:
`createSession()`, then `isExpiring()` and `refreshSession()` to keep it
current.

## ©️ Attribution

Google's [Map Tiles policies](https://developers.google.com/maps/documentation/tile/policies)
require two things wherever tiles are shown:

- **The Google Maps logo**, or the text "Google Maps" where space is limited.
- **The data attribution text** for the visible area: the `copyright` returned
  by `getViewport()`, shown in full as provided, usually in the bottom right.
  It changes as the map moves, so fetch it again when the view changes.

`google.control()` does both, picking the logo variant that suits the imagery
(`google.control({ logo: "dark" })` to override it, e.g. for a dark custom
style). With `/core`, your app is responsible for implementing this.

The logo itself is included, since Google doesn't host it at a stable URL:

- **In code:** `GOOGLE_MAPS_LOGO` from `@bamnet/google-map-tiles/core` has both
  outlined variants as SVG markup and `data:` URIs, plus the required display
  height (16–19px), clear space and accessible label.

  ```typescript
  import { GOOGLE_MAPS_LOGO } from "@bamnet/google-map-tiles/core";

  img.src = GOOGLE_MAPS_LOGO.light.dataUri; // .dark over satellite imagery
  img.alt = GOOGLE_MAPS_LOGO.alt;
  ```

- **As files:** the package includes the SVGs and 1x/2x/4x PNGs in
  `assets/google-maps-logo/`, e.g. to bundle in a MapLibre Native or Flutter
  app. They're also downloadable from JSR at
  `https://jsr.io/@bamnet/google-map-tiles/<version>/assets/google-maps-logo/`.

The Google Maps logo is a trademark of Google LLC, included only for the
attribution Google requires. It is not covered by this project's license.

Tile requests in every mode include your API key. Restrict the key to the Map
Tiles API in the Google Cloud console.

## ⚙️ Configuration Options

All modes take the same `SessionOptions`. Fields with a fixed set of values
accept either the enum (`MapType.Satellite`) or its string (`"satellite"`):

```typescript
interface SessionOptions {
  mapType: MapType; // "roadmap" | "satellite" | "terrain"
  language: string; // IETF language tag, e.g. "en-US", "fr"
  region: string; // CLDR region, e.g. "US", "JP"
  imageFormat?: ImageFormat; // "png" | "jpeg"; chosen automatically if omitted
  scale?: Scale; // "scaleFactor1x" (default) | "scaleFactor2x" | "scaleFactor4x"
  highDpi?: boolean; // high-resolution tiles; needs a 2x or 4x scale
  layerTypes?: LayerType[]; // "layerRoadmap" | "layerStreetview" | "layerTraffic"
  styles?: unknown[]; // map styling; roadmap only
  overlay?: boolean; // render layerTypes without the base map
  apiOptions?: string[];
}
```

A few combinations are required by the API: `terrain` needs the
`layerRoadmap` layer type, and `styles` only applies to `roadmap`. JPEG has no
transparency, so prefer PNG for overlays. See Google's
[session options](https://developers.google.com/maps/documentation/tile/session_tokens)
for details.

`GoogleMapTiles` and the `/core` helpers also accept a `baseUrl` option to
change the API host.

## 💡 Example

Check out the `examples` directory for a complete demo application showing how
to:

- 🗺️ Use Google tiles as a style source, with `GoogleMapTilesProtocol`
- 🔄 Switch between map types with `setStyle()`
- 🌐 Configure language and region settings
- 🔑 Validate API keys and options before loading tiles

The example is part of the repo's Bun workspace and runs against the library
source in this repo, so library changes show up immediately. To run it:

```bash
bun install
bun run examples:dev
```

To pre-fill your API key, copy `examples/.env.example` to `examples/.env.local`
and set `VITE_GOOGLE_MAPS_API_KEY`.

## 👩‍💻 Development

Development uses [Bun](https://bun.sh):

```bash
# Install dependencies
bun install

# Run tests
bun test

# Run browser tests of the example, with Google's API stubbed (no key needed)
bunx playwright install chromium  # once
bun run test:e2e

# Check types
bun run check

# Format code
bun run fmt

# Lint code
bun run lint
```

## 📄 License

Apache License 2.0 - See [LICENSE](LICENSE) for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
