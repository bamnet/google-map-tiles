import "./style.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { addProtocol, Map, removeProtocol, setWorkerUrl } from "maplibre-gl";
// MapLibre 6 loads its worker from a file next to maplibre-gl.mjs, which
// bundlers don't copy. Have Vite bundle the worker and pass MapLibre its URL.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import {
  type GoogleMapsControl,
  GoogleMapTilesProtocol,
  type LayerType,
  type MapType,
  type SessionOptions,
} from "@bamnet/google-map-tiles";

setWorkerUrl(workerUrl);

// Initialize map without tiles initially
const map = new Map({
  container: "map",
  center: [0, 0],
  zoom: 1,
  // Keep the position in the URL (#zoom/lat/lng) so views can be shared.
  hash: true,
});

// The protocol holds the API key, so each key gets its own protocol.
let google: GoogleMapTilesProtocol | undefined;
let control: GoogleMapsControl | undefined;
let currentKey = "";

// Get DOM elements
const apiKeyInput = document.getElementById("apiKey") as HTMLInputElement;
const mapTypeSelect = document.getElementById("mapType") as HTMLSelectElement;
const layerTypeSelect = document.getElementById(
  "layerType",
) as HTMLSelectElement;
const regionInput = document.getElementById("region") as HTMLInputElement;
const languageInput = document.getElementById("language") as HTMLInputElement;
const highDpiInput = document.getElementById("highDpi") as HTMLInputElement;

// Set initial API key if available from environment
if (import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
  apiKeyInput.value = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  updateMap();
}

// Add event listeners
apiKeyInput.addEventListener("change", updateMap);
mapTypeSelect.addEventListener("change", updateMap);
layerTypeSelect.addEventListener("change", updateMap);
regionInput.addEventListener("change", updateMap);
languageInput.addEventListener("change", updateMap);
highDpiInput.addEventListener("change", updateMap);

/** Session options from the form. */
function readOptions(): SessionOptions {
  const options: SessionOptions = {
    mapType: mapTypeSelect.value as MapType,
    region: regionInput.value,
    language: languageInput.value,
  };

  if (highDpiInput.checked) {
    options.scale = "scaleFactor2x";
    options.highDpi = true;
  }

  // Add layer type if selected
  const layerType = layerTypeSelect.value;
  if (layerType) {
    options.layerTypes = [layerType as LayerType];
  }

  return options;
}

/** Registers a protocol, and its logo and attribution control, for a key. */
function useKey(apiKey: string) {
  removeProtocol("google");
  google = new GoogleMapTilesProtocol(apiKey);
  addProtocol("google", google.handler);

  if (control) {
    map.removeControl(control);
  }
  control = google.control();
  map.addControl(control);
  currentKey = apiKey;
}

async function updateMap() {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) return;

  const keyChanged = apiKey !== currentKey;
  if (keyChanged || !google) {
    useKey(apiKey);
  }
  const protocol = google as GoogleMapTilesProtocol;
  const options = readOptions();

  try {
    // Report a bad key or invalid options now, rather than as tile errors.
    await protocol.validate(options);
  } catch (error) {
    console.error("Error updating map:", error);
    return;
  }

  // Google tiles are an ordinary source in the style. Changing options swaps
  // the source and keeps the camera. A new key reuses the same google:// URLs,
  // so skip the style diff to make MapLibre fetch them again.
  map.setStyle(
    {
      version: 8,
      sources: { google: protocol.source(options) },
      layers: [{ id: "google", type: "raster", source: "google" }],
    },
    { diff: !keyChanged },
  );
}
