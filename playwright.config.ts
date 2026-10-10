import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration targeting the production Vercel deployment.
 */
const productionUrl =
  process.env.PLAYWRIGHT_BASE_URL || "https://email-automation-it.vercel.app";

if (productionUrl.includes("localhost") || productionUrl.includes("127.0.0.1")) {
  throw new Error(
    `[SAFETY CHECK FAILED] Primary E2E test target must be production Vercel URL, got: ${productionUrl}`
  );
}

console.log(`\n======================================================`);
console.log(`[PLAYWRIGHT E2E] Target Production URL: ${productionUrl}`);
console.log(`======================================================\n`);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 45000,
  expect: {
    timeout: 10000,
  },
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "test-results/test-results.json" }],
  ],
  use: {
    baseURL: productionUrl,
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    navigationTimeout: 35000,
    actionTimeout: 15000,
  },
  projects: [
    {
      name: "Desktop Chrome",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        channel: "chrome",
      },
    },
    {
      name: "Mobile Chrome",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 375, height: 667 },
        channel: "chrome",
      },
    },
  ],
});
