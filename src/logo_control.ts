import type { ControlPosition, IControl, Map } from "maplibre-gl";

/**
 * Adds the Google logo to the map.
 */
export function addGoogleLogo(map: Map) {
  const logo = new GoogleLogoControl();
  map.addControl(logo, "bottom-left");
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
    this.img = document.createElement("img");
    this.img.style.padding = "0px 8px";
    this.img.src =
      "https://developers.google.com/static/maps/documentation/images/google_on_white.png";
    this.img.alt = "Google Maps";
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
