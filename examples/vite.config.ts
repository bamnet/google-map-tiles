import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// The library lives one directory up. Vite only watches the individual
// library files the example imports, and loses track of a file when git
// replaces it (e.g. on a branch switch), then keeps serving the old version.
// Watching the whole directory picks up those changes.
const library = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  plugins: [
    {
      name: "watch-library",
      configureServer(server) {
        server.watcher.add(library);
      },
    },
  ],
});
