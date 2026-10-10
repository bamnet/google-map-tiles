// The published package has no dependencies: MapLibre users bring their own
// maplibre-gl, and `/core` users don't need it at all. JSR would quietly add
// a dependency for any package the published code imports, so this checks
// that the code only imports its own files.
import { expect, test } from "bun:test";

const ROOT = new URL("../", import.meta.url);

async function publishedFiles(): Promise<string[]> {
  const src = await Array.fromAsync(
    new Bun.Glob("src/*.ts").scan({ cwd: ROOT.pathname }),
  );
  return ["mod.ts", "core.ts", ...src].filter(
    (f) => !f.endsWith("_test.ts") && f !== "src/test_helpers.ts",
  );
}

test("the published code only imports its own files", async () => {
  const files = await publishedFiles();
  expect(files).toContain("src/maplibre_protocol.ts");

  for (const file of files) {
    // Comments are left out: doc examples import maplibre-gl.
    const source = (await Bun.file(new URL(file, ROOT)).text())
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    const specifiers = [
      ...source.matchAll(/\bfrom\s+["']([^"']+)["']/g),
      ...source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']/g),
      ...source.matchAll(/^\s*import\s+["']([^"']+)["']/gm),
    ].map(([, specifier]) => specifier);
    for (const specifier of specifiers) {
      expect({ file, specifier }).toEqual({
        file,
        specifier: expect.stringMatching(/^\.\.?\//),
      });
    }
  }
});

test("jsr.json and package.json declare no dependencies", async () => {
  const jsr = await Bun.file(new URL("jsr.json", ROOT)).json();
  const pkg = await Bun.file(new URL("package.json", ROOT)).json();

  expect(jsr.imports).toBeUndefined();
  expect(pkg.dependencies).toBeUndefined();
  // MapLibre users install maplibre-gl themselves; npm-based tools use this
  // to warn about versions outside the supported range.
  expect(Object.keys(pkg.peerDependencies)).toEqual(["maplibre-gl"]);
});
