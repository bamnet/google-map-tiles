/** Creates the Google Maps logo image shown by `GoogleMapsControl`. */
export function createGoogleLogo(): HTMLImageElement {
  const img = document.createElement("img");
  img.style.padding = "0px 8px";
  img.src =
    "https://developers.google.com/static/maps/documentation/images/google_on_white.png";
  img.alt = "Google Maps";
  return img;
}
