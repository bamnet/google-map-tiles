# Google Maps logo

The Google Maps logo, as required by the
[Map Tiles API policies](https://developers.google.com/maps/documentation/tile/policies)
wherever Google tiles are shown. These are the two outlined variants from
Google's
[attribution assets](https://developers.google.com/static/maps/documentation/images/Google_Maps_Attribution_Assets.zip),
unmodified:

| File | Use on |
|---|---|
| `GoogleMaps_Logo_WithLightOutline*` (dark text, light outline) | Light maps, e.g. roadmap and terrain |
| `GoogleMaps_Logo_WithDarkOutline*` (light text, dark outline) | Dark maps, e.g. satellite imagery |

Each is provided as SVG and as PNG at 1x (105×22), 2x and 4x. Display the logo
16–19px tall, with 10px of clear space on the left, right and top and 5px at
the bottom, and label it "Google Maps" for accessibility.

`GoogleMapsControl` shows the right variant automatically, and the SVGs are
also exported as `GOOGLE_MAPS_LOGO` from `@bamnet/google-map-tiles/core`. To
update them, replace the files here and run `bun run generate:logo`.

The Google Maps logo is a trademark of Google LLC. It is included only for the
attribution Google requires, and is not covered by this project's license.
