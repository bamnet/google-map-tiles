import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

// Browser tests of the built example, with Google's API stubbed out, so no
// API key is needed. Run with: bun run test:e2e
export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `bun run examples:build && bun run --cwd examples preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // Always rebuild, so the test never runs against an older build.
    reuseExistingServer: false,
    // Build with a placeholder key, overriding any real one in .env.local.
    // The example then loads the map as soon as the page opens.
    env: { VITE_GOOGLE_MAPS_API_KEY: "e2e-test-key" },
  },
});
