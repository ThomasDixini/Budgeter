import { test as base } from '@playwright/test';
import { E2E_BASE_URL, E2eSession, openSession } from './account';

/*
 * Specs freeze the browser clock in years ahead (to own a month of data), and the app drops a session whose
 * expiry its clock has passed. The browser copy therefore never expires; the API still judges the token by
 * its own, real clock.
 */
const FAR_FUTURE = '2100-01-01T00:00:00.000Z';

/** Same key the app keeps its session under. */
const SESSION_STORAGE_KEY = 'orbit.session';

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
