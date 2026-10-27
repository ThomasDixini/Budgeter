import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const isContinuousIntegration = Boolean(process.env['CI']);

/*
 * The suite runs on its own ports with its own API and SQLite file, so it never touches the
 * developer's servers or local budgeter.db. Each run starts from a fresh database.
 */
const apiUrl = 'http://localhost:5199';
const baseUrl = 'http://localhost:4300';
const e2eDatabase = join(tmpdir(), `budgeter-e2e-${Date.now()}.db`);

/** E2E suite for critical user flows; runs against the Angular dev server and the API. */
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
  webServer: [
    {
      command: `dotnet run --project ../api --no-launch-profile --urls ${apiUrl}`,
      url: apiUrl,
      reuseExistingServer: !isContinuousIntegration,
      timeout: 180_000,
      env: {
        ASPNETCORE_ENVIRONMENT: 'Development',
        ConnectionStrings__Budgeter: `Data Source=${e2eDatabase}`,
        Persistence__SeedSampleData: 'true',
      },
    },
    {
      command: 'npm run start -- --port 4300',
      url: baseUrl,
      reuseExistingServer: !isContinuousIntegration,
      timeout: 120_000,
      env: { BUDGETER_API_URL: apiUrl },
    },
  ],
});
