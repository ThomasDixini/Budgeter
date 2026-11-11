import { expect, test } from './support/test';
import { LandingPage } from './pages/landing.page';

let landing: LandingPage;

test.beforeEach(async ({ page }) => {
  landing = new LandingPage(page);
  await landing.goto();
});

test.describe('landing page', () => {
  test('presents the project', async () => {
    await expect(landing.headline).toContainText('Your routine');
    await expect(landing.headline).toContainText('your money');
  });

  test('reaches the sign-in and comes back', async ({ page }) => {
    await landing.signInLinks.first().click();

    await expect(page).toHaveURL('/login');
    await page.getByRole('link', { name: 'Back to the site' }).click();
    await expect(page).toHaveURL('/');
  });

  test('has no /modules route: it falls back to the landing page', async ({ page }) => {
    await page.goto('/modules');

    await expect(page).toHaveURL('/');
  });

  test('unknown paths fall back to the landing page', async ({ page }) => {
    await page.goto('/does-not-exist');

    await expect(page).toHaveURL('/');
    await expect(landing.headline).toContainText('Your routine');
  });

  test('the layout never scrolls sideways', async () => {
    await expect(landing.headline).toBeVisible();

    expect(await landing.horizontalOverflow()).toBe(0);
  });
});

test.describe('module wheel', () => {
  test('opens on the routines module with a link to it', async () => {
    await expect(landing.activeModuleName).toHaveText('Routines & Goals');
    await expect(landing.openModuleLink).toHaveAttribute('href', '/routines');
  });

  test('spinning right brings Finances forward', async () => {
    await landing.spinRight();

    await expect(landing.activeModuleName).toHaveText('Finances');
    await expect(landing.openModuleLink).toHaveAttribute('href', '/finances');
  });

  test('spinning left from the first module wraps to a module that is not built yet', async () => {
    await landing.spinLeft();

    await expect(landing.activeModuleName).toHaveText('Coming soon');
    await expect(landing.openModuleLink).toHaveCount(0);
  });

  test('spins with the keyboard', async ({ page }) => {
    await landing.spinRightButton.focus();

    await page.keyboard.press('Enter');

    await expect(landing.activeModuleName).toHaveText('Finances');
  });
});
