import type { ControlPosition, IControl, Map } from "maplibre-gl";

/**
 * Adds the Google logo to the map.
 * @returns The added control, for later removal with `map.removeControl()`.
 */
export function addGoogleLogo(map: Map): GoogleLogoControl {
  const logo = new GoogleLogoControl();
  map.addControl(logo, "bottom-left");
  return logo;
}

/**
 * A control that displays the Google logo on the map.
 */
export class GoogleLogoControl implements IControl {
  private img?: HTMLImageElement;

  getDefaultPosition(): ControlPosition {
    return "bottom-right";
  }

  /** Add an image with the Google Logo. */
  onAdd(_: Map): HTMLElement {
    this.img = createGoogleLogo();
    return this.img;
  }

  /** {@inheritDoc IControl.onRemove} */
  onRemove(_: Map): void {
    if (this.img) {
      this.img.remove();
      this.img = undefined;
    }
  }
}

/** Creates the Google Maps logo image used by the map controls. */
export function createGoogleLogo(): HTMLImageElement {
  const img = document.createElement("img");
  img.style.padding = "0px 8px";
  img.src =
    "https://developers.google.com/static/maps/documentation/images/google_on_white.png";
  img.alt = "Google Maps";
  return img;
}
