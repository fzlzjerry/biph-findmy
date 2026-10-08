import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against the real FastAPI backend, which also serves the built SPA from
// frontend/dist (exactly like production). The demo database is re-seeded on every run.
const PORT = 8765;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  // The flows share one seeded database (claims change item state), so run them in order.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    locale: "en-US",
    timezoneId: "Asia/Shanghai",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
  ],
  webServer: {
    // Build the SPA, then (from the repo root) reset the demo data and start the API on :8765.
    command:
      "bash -lc 'npm --prefix frontend run build && uv run python -m backend.app.seed --reset && exec uv run uvicorn backend.app.main:app --port 8765'",
    cwd: "..",
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 240_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      APP_ENV: "development",
      AUTH_BACKEND: "local",
      DEV_SHOW_CODE: "true",
      ADMIN_EMAILS: "desk.demo@findmy.local",
      DATABASE_URL: "sqlite:///./data/e2e.sqlite3",
      LOCAL_STORAGE_DIR: "./data/e2e-uploads",
      MATCHER_TEXT_BACKEND: "auto",
    },
  },
});
