// Checks that the library loads and works on Node, not just Bun.
// Run with: node --experimental-transform-types scripts/node_smoke.mjs
import assert from "node:assert/strict";

globalThis.fetch = async () =>
  Response.json({
    session: "mock-session",
    expiry: "1792807483",
    tileWidth: 256,
    tileHeight: 256,
    imageFormat: "png",
  });

for (const entry of ["../core.ts", "../mod.ts"]) {
  const { createGoogleStyle } = await import(entry);
  const { style, expiresAt } = await createGoogleStyle("key", {
    mapType: "roadmap",
    language: "en-US",
    region: "US",
  });
  assert.match(
    style.sources["google-map-tiles"].tiles[0],
    /session=mock-session/,
  );
  assert.equal(expiresAt.getTime(), 1792807483 * 1000);
  console.log(`${entry}: ok`);
}
