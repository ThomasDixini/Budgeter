import { APIRequestContext } from '@playwright/test';

/** What the API answers to a sign-in or sign-up. */
export interface E2eSession {
  readonly token: string;
  readonly expiresAt: string;
  readonly user: { readonly id: string; readonly email: string; readonly name: string };
}

/** Where the suite serves the app (see playwright.config.ts); worker fixtures cannot read `baseURL`. */
export const E2E_BASE_URL = 'http://localhost:4300';

/*
 * One account for the whole run: the data every test reads and writes belongs to it (see starter-data.ts),
 * as it used to belong to the single database. Each run starts from a fresh database, so the account is
 * created before the first test and every worker signs in to it.
 */
const E2E_ACCOUNT = { name: 'E2E Tester', email: 'e2e@orbit.test', password: 'e2e-password-123' };

/**
 * Creates the suite's account, or signs in to it when an earlier run left it behind.
 * @example const session = await openSession(anonymousRequest)
 */
export async function openSession(request: APIRequestContext): Promise<E2eSession> {
  const registered = await request.post('/api/auth/register', { data: E2E_ACCOUNT });
  if (registered.ok()) return (await registered.json()) as E2eSession;
  const signedIn = await request.post('/api/auth/login', {
    data: { email: E2E_ACCOUNT.email, password: E2E_ACCOUNT.password },
  });
  if (!signedIn.ok()) {
    throw new Error(
      `Expected the e2e account to register or sign in, received ${registered.status()} and ${signedIn.status()}`,
    );
  }
  return (await signedIn.json()) as E2eSession;
}
