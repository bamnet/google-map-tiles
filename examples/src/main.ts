import "./style.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { Map } from "maplibre-gl";
import {
  addGoogleMapTiles,
  type GoogleMapTilesSource,
  type LayerType,
  type MapType,
} from "@bamnet/google-map-tiles";

// Initialize map without tiles initially
const map = new Map({
  container: "map",
  center: [0, 0],
  zoom: 1,
});

let currentTiles: GoogleMapTilesSource | null = null;

// Get DOM elements
const apiKeyInput = document.getElementById("apiKey") as HTMLInputElement;
const mapTypeSelect = document.getElementById("mapType") as HTMLSelectElement;
const layerTypeSelect = document.getElementById(
  "layerType",
) as HTMLSelectElement;
const regionInput = document.getElementById("region") as HTMLInputElement;
const languageInput = document.getElementById("language") as HTMLInputElement;

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

async function updateMap() {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) return;

  try {
    // Remove existing tiles if any
    if (currentTiles) {
      currentTiles.removeFromMap(map);
    }

    // Add new tiles with current options
    const options = {
      mapType: mapTypeSelect.value as MapType,
      region: regionInput.value,
      language: languageInput.value,
    };

    // Add layer type if selected
    const layerType = layerTypeSelect.value;
    if (layerType) {
      options.layerTypes = [layerType as LayerType];
    }

    currentTiles = await addGoogleMapTiles(apiKey, map, options);
  } catch (error) {
    console.error("Error updating map:", error);
  }
}
