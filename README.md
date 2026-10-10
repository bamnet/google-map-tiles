# 🗺️ Google Map Tiles for MapLibre GL

A TypeScript library that enables the use of
[Google Map Tiles](https://developers.google.com/maps/documentation/tile) API in
MapLibre GL JS applications. It provides session handling, attribution, and
various map configurations.

Demo @ https://bamnet.github.io/google-map-tiles/

[![Build](https://github.com/bamnet/google-map-tiles/actions/workflows/ci.yaml/badge.svg)](https://github.com/bamnet/google-map-tiles/actions/workflows/ci.yaml)
[![JSR](https://jsr.io/badges/@bamnet/google-map-tiles)](https://jsr.io/@bamnet/google-map-tiles)

## ✨ Features

- 🌍 Easy integration with MapLibre GL JS
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

The MapLibre integration requires `maplibre-gl` 6.4.1 or later. The
`@bamnet/google-map-tiles/core` entry point works without MapLibre.

## 🚀 Quick Start

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

## ⚙️ Configuration Options

The library supports various configuration options through the `SessionOptions`
interface:

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

## 🔧 Advanced Usage

### Using GoogleMapTilesSourceManager Directly

For more control over the tile source:

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

### Without MapLibre GL JS (`/core`)

`@bamnet/google-map-tiles/core` contains the Tile API client and helpers that
build plain MapLibre source and style JSON. It has no dependencies and runs
anywhere `fetch` is available: browsers, Node, Bun, Deno and edge runtimes.

Build a complete style, for example on a server, to hand to any client that
loads MapLibre styles (MapLibre Native, Flutter, or MapLibre GL JS):

```typescript
import { createGoogleStyle } from "@bamnet/google-map-tiles/core";

const { style, expiresAt } = await createGoogleStyle("YOUR_API_KEY", {
  mapType: "roadmap",
  language: "en-US",
  region: "us",
});
// Serve `style` as JSON. Its tile URLs stop working at `expiresAt`
// (currently about two weeks), so create a new one before then.
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

Tile URLs in sources and styles include your API key, so restrict the key to
the Map Tiles API in the Google Cloud console.

For direct access to the Google Maps Tiles API:

```typescript
import { GoogleMapTiles, MapType } from "@bamnet/google-map-tiles/core";

const client = new GoogleMapTiles("YOUR_API_KEY");
await client.createSession({
  mapType: MapType.Roadmap,
  language: "en-US",
  region: "us",
});

// Get viewport information
const viewport = await client.getViewport(10, 40, 30, -70, -80);

// Get tile URLs
const tileUrl = client.tileUrl(15, 6294, 13288);
const template = client.tileUrlTemplate(); // .../{z}/{x}/{y}?...

// Sessions expire; refresh before then
if (client.isExpiring()) {
  await client.refreshSession();
}
```

`GoogleMapTiles` also accepts `{ fetch, baseUrl }` options to supply your own
`fetch` implementation or API host.

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
