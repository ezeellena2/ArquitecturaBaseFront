import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./src/test/visual",
  snapshotPathTemplate: "./src/test/visual/screenshots/{arg}{ext}",
  outputDir: "./test-results/visual",
  fullyParallel: true,
  workers: 3,
  use: { browserName: "chromium", baseURL: "http://127.0.0.1:5178", locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires", colorScheme: "light", reducedMotion: "reduce", trace: "retain-on-failure" },
  expect: { toHaveScreenshot: { animations: "disabled", maxDiffPixelRatio: 0.002 } },
  webServer: { command: "node src/test/visual/server.mjs", url: "http://127.0.0.1:5178/__visual_ready", reuseExistingServer: false },
});
