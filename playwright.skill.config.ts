import { defineConfig } from "@playwright/test";

const host = "127.0.0.1";
const port = 4173;
const baseURL = `http://${host}:${port}`;

/**
 * Runs skill/templates as generated tests. Point a template at a fixture
 * with UI_BREAK_TARGET_PATH. Used by `npm run verify:skill`, not `npm test`.
 */
export default defineConfig({
  testDir: "./skill/templates",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL,
    browserName: "chromium",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: {
    command: `npm run build && npx vite preview --host ${host} --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
