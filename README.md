# 🗺️ Google Map Tiles

A TypeScript library for the
[Google Map Tiles API](https://developers.google.com/maps/documentation/tile).
It adds Google tiles to MapLibre GL JS in one call, with attribution and the
Google Maps logo handled for you. Its dependency-free core also builds MapLibre
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

`@bamnet/google-map-tiles/core` has no dependencies and runs anywhere `fetch`
is available: browsers, Node, Bun, Deno and edge runtimes. The main entry point
includes everything in `/core`, and requires `maplibre-gl` 6.4.1 or later.

## 🗺️ With MapLibre GL JS

```typescript
import { Map } from "maplibre-gl";
import { addGoogleMapTiles } from "@bamnet/google-map-tiles";

const map = new Map({
  container: "map",
  center: [0, 0],
  zoom: 1,
});

// Add Google Maps tiles to your MapLibre map
await addGoogleMapTiles("YOUR_API_KEY", map, {
  mapType: "roadmap",
  language: "en-US",
  region: "us",
});
```

This adds the tiles, keeps the map's attribution up to date as it moves, and
shows the Google Maps logo.

For more control, use `GoogleMapTilesSourceManager` directly:

```typescript
import { GoogleMapTilesSourceManager } from "@bamnet/google-map-tiles";

const source = await GoogleMapTilesSourceManager.create("YOUR_API_KEY", {
  mapType: "satellite",
  language: "fr",
  region: "fr",
});

source.addToMap(map);

// Later, when needed:
source.removeFromMap(map);
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
import { SessionPool } from "@bamnet/google-map-tiles/core";

const pool = new SessionPool("YOUR_API_KEY");

// The first call creates a session; later calls with the same options reuse
// it, and it's replaced automatically shortly before it expires.
const client = await pool.client({
  mapType: "roadmap",
  language: "en-US",
  region: "us",
});

// A single tile, e.g. for an <img>
const url = client.tileUrl(15, 6294, 13288);

// Or a {z}/{x}/{y} template, for libraries that take one
const template = client.tileUrlTemplate();

// Attribution for what's on screen: zoom, then north, south, east, west
const { copyright } = await client.getViewport(15, 40.8, 40.7, -73.9, -74.0);
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

`addGoogleMapTiles()` does both. With `/core`, your app is responsible for
implementing this.

Tile URLs from every mode include your API key. Restrict the key to the Map
Tiles API in the Google Cloud console.

## ⚙️ Configuration Options

All modes take the same `SessionOptions`:

```typescript
interface SessionOptions {
  mapType: "roadmap" | "satellite" | "terrain" | "streetview";
  language: string; // e.g., "en-US", "fr", "de"
  region: string; // e.g., "us", "uk", "jp"
  imageFormat?: string; // Optional image format
  scale?: string; // Optional scale factor
  highDpi?: boolean; // Optional high DPI support
  layerTypes?: string[]; // Optional layer types
  styles?: unknown[]; // Optional custom styles
  overlay?: boolean; // Optional overlay mode
  apiOptions?: string[]; // Optional API options
}
```

`GoogleMapTiles` and the `/core` helpers also accept a `baseUrl` option to
change the API host.

## 💡 Example

Check out the `examples` directory for a complete demo application showing how
to:

- 🗺️ Initialize a map with Google tiles
- 🔄 Switch between map types
- 🌐 Configure language and region settings
- 🔑 Handle API keys

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
