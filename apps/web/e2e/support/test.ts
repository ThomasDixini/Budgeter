import { APIRequestContext, test as base } from '@playwright/test';

/** What the API answers to a sign-in or sign-up. */
export interface E2eSession {
  readonly token: string;
  readonly expiresAt: string;
  readonly user: { readonly id: string; readonly email: string; readonly name: string };
}

/** Where the suite serves the app (see playwright.config.ts); worker fixtures cannot read `baseURL`. */
const E2E_BASE_URL = 'http://localhost:4300';

/*
 * Specs freeze the browser clock in years ahead (to own a month of data), and the app drops a session whose
 * expiry its clock has passed. The browser copy therefore never expires; the API still judges the token by
 * its own, real clock.
 */
const FAR_FUTURE = '2100-01-01T00:00:00.000Z';

/** Same key the app keeps its session under. */
const SESSION_STORAGE_KEY = 'orbit.session';

/*
 * One account for the whole run: the data every test reads and writes (the sample routines, the starter
 * finance categories) belongs to it, as it used to belong to the single database. Each run starts from a
 * fresh database, so the account is created by the first worker and signed in to by the others.
 */
const E2E_ACCOUNT = { name: 'E2E Tester', email: 'e2e@orbit.test', password: 'e2e-password-123' };

async function openSession(request: APIRequestContext): Promise<E2eSession> {
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

interface TestOptions {
  /** Whether the browser starts signed in; turn it off to test the landing page or the sign-in itself. */
  signedIn: boolean;
}

interface WorkerFixtures {
  session: E2eSession;
}

/**
 * Playwright's `test`, with the e2e account signed in: the page already holds its session, and the `request`
 * fixture sends its token, so specs seed data and open screens as that account.
 * @example test.use({ signedIn: false }) // in a spec about the sign-in
 */
export const test = base.extend<TestOptions, WorkerFixtures>({
  signedIn: [true, { option: true }],

  session: [
    async ({ playwright }, use) => {
      const anonymous = await playwright.request.newContext({ baseURL: E2E_BASE_URL });
      await use(await openSession(anonymous));
      await anonymous.dispose();
    },
    { scope: 'worker' },
  ],

  context: async ({ context, session, signedIn }, use) => {
    if (signedIn) {
      await context.addInitScript(
        ([key, value]) => {
          if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, value);
        },
        [SESSION_STORAGE_KEY, JSON.stringify({ ...session, expiresAt: FAR_FUTURE })],
      );
    }
    await use(context);
  },

  request: async ({ playwright, baseURL, session, signedIn }, use) => {
    const authorized = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: signedIn ? { Authorization: `Bearer ${session.token}` } : {},
    });
    await use(authorized);
    await authorized.dispose();
  },
});

export { expect } from '@playwright/test';
