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
  // The default (half the cores) starts so many browsers against one dev server and one SQLite file that
  // checks time out on a laptop; three keeps the suite steady and still fast.
  workers: isContinuousIntegration ? undefined : 3,
  forbidOnly: isContinuousIntegration,
  // No retries: a test that only passes on a second try is a bug to see, not to hide; the trace of
  // the failed attempt is kept.
  retries: 0,
  reporter: isContinuousIntegration ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: baseUrl,
    // The tests read English texts; the app follows the browser language otherwise.
    locale: 'en-US',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: `dotnet run --project ../api --no-launch-profile --urls ${apiUrl}`,
      url: `${apiUrl}/health`,
      reuseExistingServer: !isContinuousIntegration,
      timeout: 180_000,
      env: {
        ASPNETCORE_ENVIRONMENT: 'Development',
        ConnectionStrings__Budgeter: `Data Source=${e2eDatabase}`,
        Persistence__SeedSampleData: 'true',
        // The CDI comes from the Central Bank; the suite never reaches the internet.
        Cdi__Enabled: 'false',
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
