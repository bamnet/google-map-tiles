import "./style.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { Map } from "maplibre-gl";
import {
  addGoogleMapTiles,
  type GoogleMapTilesSource,
  type MapType,
} from "../../mod.ts";

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
    currentTiles = await addGoogleMapTiles(apiKey, map, {
      mapType: mapTypeSelect.value as MapType,
      region: regionInput.value,
      language: languageInput.value,
    });
  } catch (error) {
    console.error("Error updating map:", error);
  }
}
