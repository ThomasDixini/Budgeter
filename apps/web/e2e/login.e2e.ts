import { randomUUID } from 'node:crypto';
import { expect, test } from './support/test';

test.use({ signedIn: false });

const PASSWORD = 'orbit-e2e-password';

function newEmail(): string {
  return `person-${randomUUID().slice(0, 8)}@orbit.test`;
}

test.describe('closed modules', () => {
  test('a visitor who is not signed in is sent to the sign-in from a module', async ({ page }) => {
    await page.goto('/routines');

    await expect(page).toHaveURL('/login');
  });

  test('the API refuses a request without a token', async ({ request }) => {
    const response = await request.get('/api/categories');

    expect(response.status()).toBe(401);
  });
});

test.describe('creating an account', () => {
  test('signs up and enters the app', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('tab', { name: 'Create account' }).click();

    await page.getByLabel('Name').fill('Bia');
    await page.getByLabel('E-mail').fill(newEmail());
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).last().click();
    await page.getByRole('link', { name: 'Enter the app' }).click();

    await expect(page).toHaveURL('/routines');
    // A new account starts with nothing: no routine, no task, no category.
    await expect(page.getByText('Nothing for today.')).toBeVisible();
    await expect(page.getByText('No routine runs today.')).toBeVisible();
  });

  test('refuses an e-mail that already has an account', async ({ page }) => {
    const email = newEmail();
    await page.request.post('/api/auth/register', {
      data: { name: 'Bia', email, password: PASSWORD },
    });
    await page.goto('/login');
    await page.getByRole('tab', { name: 'Create account' }).click();

    await page.getByLabel('Name').fill('Bia');
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).last().click();

    await expect(page.getByText('There is already an account with this e-mail.')).toBeVisible();
  });
});

test.describe('signing in and out', () => {
  test('a wrong password is refused and nothing opens', async ({ page }) => {
    const email = newEmail();
    await page.request.post('/api/auth/register', {
      data: { name: 'Bia', email, password: PASSWORD },
    });
    await page.goto('/login');

    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).last().click();

    await expect(page.getByText('Wrong e-mail or password.')).toBeVisible();
  });

  test('signs in, reaches the module, and signing out closes it again', async ({ page }) => {
    const email = newEmail();
    await page.request.post('/api/auth/register', {
      data: { name: 'Bia', email, password: PASSWORD },
    });
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).last().click();
    await page.getByRole('link', { name: 'Enter the app' }).click();
    await expect(page).toHaveURL('/routines');

    await page.getByRole('button', { name: 'Sign out' }).click();

    await expect(page).toHaveURL('/');
    await page.goto('/routines');
    await expect(page).toHaveURL('/login');
  });

  test('two accounts never see each other’s categories', async ({ playwright, baseURL }) => {
    const first = await playwright.request.newContext({ baseURL });
    const second = await playwright.request.newContext({ baseURL });
    const ana = await (
      await first.post('/api/auth/register', {
        data: { name: 'Ana', email: newEmail(), password: PASSWORD },
      })
    ).json();
    const bia = await (
      await second.post('/api/auth/register', {
        data: { name: 'Bia', email: newEmail(), password: PASSWORD },
      })
    ).json();
    const headers = (token: string) => ({ Authorization: `Bearer ${token}` });
    await first.post('/api/categories', {
      headers: headers(ana.token),
      data: { id: 'private-study', name: 'Private study', color: '#7DD3FC' },
    });

    const seenByBia = await second.get('/api/categories', { headers: headers(bia.token) });

    expect(await seenByBia.text()).not.toContain('private-study');
  });
});
