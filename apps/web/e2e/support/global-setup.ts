import { request } from '@playwright/test';
import { E2E_BASE_URL, openSession } from './account';
import { seedStarterData } from './starter-data';

/**
 * Runs once, before any worker: creates the suite's account and gives it the starting data, so no test
 * starts while another is still preparing it.
 */
export default async function globalSetup(): Promise<void> {
  const anonymous = await request.newContext({ baseURL: E2E_BASE_URL });
  const session = await openSession(anonymous);
  const signedIn = await request.newContext({
    baseURL: E2E_BASE_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${session.token}` },
  });
  await seedStarterData(signedIn);
  await Promise.all([anonymous.dispose(), signedIn.dispose()]);
}
