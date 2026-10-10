// Checks, at type-check time (`bun run check`), that this library's own
// MapLibre types stay compatible with maplibre-gl's. The package doesn't
// depend on maplibre-gl, so this is what catches a maplibre-gl release that
// changes the APIs we use. Nothing from maplibre-gl runs here.
import { expectTypeOf, test } from "bun:test";
import type {
  GetResourceResponse,
  IControl,
  Map,
  RasterSourceSpecification,
  RequestParameters,
  StyleSpecification,
} from "maplibre-gl";
import type { GoogleMapsControl } from "./google_maps_control.ts";
import { GoogleMapTilesProtocol } from "./maplibre_protocol.ts";
import type { RasterSource, Style } from "./maplibre_style.ts";
import type {
  MapLike,
  MapStyleLike,
  ProtocolRequest,
  ProtocolResponse,
} from "./maplibre_types.ts";

declare const maplibre: typeof import("maplibre-gl");

test("our MapLibre types are compatible with maplibre-gl's", () => {
  // What MapLibre passes to us.
  expectTypeOf<Map>().toExtend<MapLike>();
  expectTypeOf<StyleSpecification>().toExtend<MapStyleLike>();
  expectTypeOf<RequestParameters>().toExtend<ProtocolRequest>();

  // What we pass to MapLibre.
  expectTypeOf<ProtocolResponse>().toExtend<GetResourceResponse<ArrayBuffer>>();
  expectTypeOf<GoogleMapsControl>().toExtend<IControl>();
  expectTypeOf<RasterSource>().toExtend<RasterSourceSpecification>();
  expectTypeOf<Style>().toExtend<StyleSpecification>();
});

test("the integration type-checks the way an app uses it", () => {
  // Never called: it only needs to compile.
  const app = (map: Map) => {
    const google = new GoogleMapTilesProtocol("key");
    maplibre.addProtocol("google", google.handler);
    map.addControl(google.control());
    map.addControl(google.control({ logo: "dark" }), "top-right");
    map.setStyle({
      version: 8,
      sources: {
        google: google.source({
          mapType: "roadmap",
          language: "en-US",
          region: "US",
        }),
      },
      layers: [{ id: "google", type: "raster", source: "google" }],
    });
    map.removeControl(google.control());
  };
  expectTypeOf(app).toBeFunction();
});
