const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./test/browser",
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://localhost:8094",
    channel: "msedge",
    reducedMotion: "reduce",
    viewport: { width: 1440, height: 1080 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  reporter: "list",
});
