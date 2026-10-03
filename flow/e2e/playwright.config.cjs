// Runs against a running Frappe site with briskrew and the demo team seeded:
//   bench --site <site> execute hrms.briskrew.demo.setup_site   (developer_mode sites only)
// E2E_BASE_URL defaults to http://127.0.0.1:8000; E2E_ADMIN_PASSWORD to "admin".
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:8000",
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: process.env.E2E_CHROMIUM
      ? { executablePath: process.env.E2E_CHROMIUM }
      : {},
  },
});
