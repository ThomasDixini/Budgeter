import { defineConfig, devices } from '@playwright/test';

const isContinuousIntegration = Boolean(process.env['CI']);
const baseUrl = 'http://localhost:4200';

/** E2E suite for critical user flows; runs against the Angular dev server. */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: isContinuousIntegration,
  retries: isContinuousIntegration ? 2 : 0,
  reporter: isContinuousIntegration ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: baseUrl,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run start',
    url: baseUrl,
    reuseExistingServer: !isContinuousIntegration,
    timeout: 120_000,
  },
});
