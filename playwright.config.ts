import { defineConfig } from "@playwright/test";

const host = "127.0.0.1";
const port = 4173;
const baseURL = `http://${host}:${port}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL,
    browserName: "chromium",
    trace: "on-first-retry",
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
