import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  // tests/unit/ holds node:test unit tests (run with `npm run test:unit`),
  // not Playwright specs - Playwright would fail trying to collect them.
  testIgnore: ['**/unit/**'],
  timeout: 60_000,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never', outputFolder: 'playwright-report' }], ['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
