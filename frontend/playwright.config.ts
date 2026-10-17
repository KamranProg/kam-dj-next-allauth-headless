import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  // The first visit to a page in dev mode compiles it, which can take a while.
  timeout: 60_000,
  // Tests share one Mailpit inbox and allauth's per-IP rate limits, so run them one by one.
  workers: 1,
  fullyParallel: false,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      // Locally use the Chrome that is already installed; CI installs Playwright's Chromium.
      use: { ...devices["Desktop Chrome"], channel: isCI ? undefined : "chrome" },
    },
  ],
  // Reuses servers that are already running (for example `make dev`).
  webServer: [
    {
      command: "uv run python backend/manage.py runserver 8000 --noreload",
      cwd: "../backend",
      url: "http://localhost:8000/api/health/",
      // Repeated runs sign in more often than allauth's rate limits allow (dev only).
      env: { DISABLE_RATE_LIMITS: "True" },
      reuseExistingServer: !isCI,
      timeout: 60_000,
    },
    {
      command: isCI ? "pnpm build && pnpm start" : "pnpm dev",
      url: "http://localhost:3000",
      reuseExistingServer: !isCI,
      timeout: 180_000,
    },
  ],
});
