import { defineConfig, devices } from '@playwright/test';

/**
 * The Phase 5 gate: layouts at 320, 375, 390 and 430 px and on desktop, and
 * keyboard reach with visible focus. Those are the widths real phones use,
 * and 320 is included because it is where a layout that "works on mobile"
 * usually stops working.
 */
const PORT = 3100;

/**
 * Some environments ship a pre-installed Chromium at a fixed path rather than
 * the build this Playwright version would download. Honour it when it is set
 * so CI and sandboxes do not have to re-fetch a browser they already have.
 */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const launch = executablePath ? { launchOptions: { executablePath } } : {};

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], ...launch } },
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        ...launch,
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: {
    command: `npx next start --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
