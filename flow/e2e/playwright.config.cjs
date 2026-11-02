// Runs against a running Frappe site with briskrew and the demo team seeded:
//   bench --site <site> execute hrms.briskrew.demo.setup_site   (developer_mode sites only)
// E2E_BASE_URL defaults to http://127.0.0.1:8000; E2E_ADMIN_PASSWORD to "admin".
const { defineConfig } = require("@playwright/test");

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:8000";

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL,
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    // Full Chromium in its new headless mode: the headless shell ignores the flag below.
    channel: process.env.E2E_CHROMIUM ? undefined : "chromium",
    launchOptions: {
      ...(process.env.E2E_CHROMIUM
        ? { executablePath: process.env.E2E_CHROMIUM }
        : {}),
      // Browsers only share location with secure origins. CI serves the site over plain http
      // under its own host name (not localhost), so the check-in test needs it treated as secure.
      args: [
        `--unsafely-treat-insecure-origin-as-secure=${new URL(baseURL).origin}`,
      ],
    },
  },
});
