import { expect, test } from '@playwright/test';
import { HomePage } from './pages/home.page';

let home: HomePage;

test.beforeEach(async ({ page }) => {
  home = new HomePage(page);
  await home.goto();
});

test.describe('home module wheel', () => {
  test('opens on the routines module with a link to it', async () => {
    await expect(home.title).toHaveText('Routines & Goals');
    await expect(home.counter).toHaveText('Module 1 of 4');
    await expect(home.openModuleLink).toHaveAttribute('href', '/routines');
  });

  test('spinning right brings the next module to the spotlight', async () => {
    await home.spinRight();

    await expect(home.title).toHaveText('Finances');
    await expect(home.openModuleLink).toHaveAttribute('href', '/finances');
  });

  test('spinning left from the first module wraps to the last one', async () => {
    await home.spinLeft();

    await expect(home.counter).toHaveText('Module 4 of 4');
    await expect(home.title).toHaveText('Coming soon');
  });

  test('hides the open link for a module that is not built yet', async () => {
    await home.spinRight();
    await home.spinRight();

    await expect(home.title).toHaveText('Coming soon');
    await expect(home.openModuleLink).toHaveCount(0);
  });

  test('spins with the keyboard', async ({ page }) => {
    await home.spinRightButton.focus();

    await page.keyboard.press('Enter');

    await expect(home.title).toHaveText('Finances');
  });
});

test.describe('module picker', () => {
  test('lists every module and moves focus into the dialog', async () => {
    await home.allModulesButton.click();

    await expect(home.picker).toBeVisible();
    await expect(home.picker.getByRole('button', { name: /Coming soon/ })).toHaveCount(2);
    await expect(home.pickerCloseButton).toBeFocused();
  });

  test('picking a module spotlights it and closes the picker', async () => {
    await home.pickModule('Finances');

    await expect(home.picker).toBeHidden();
    await expect(home.title).toHaveText('Finances');
  });

  test('closes with the close button', async () => {
    await home.allModulesButton.click();

    await home.pickerCloseButton.click();

    await expect(home.picker).toBeHidden();
  });

  test('closes with Escape', async ({ page }) => {
    await home.allModulesButton.click();
    await expect(home.picker).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(home.picker).toBeHidden();
  });
});

test.describe('navigation', () => {
  test('unknown paths fall back to the home screen', async ({ page }) => {
    await page.goto('/does-not-exist');

    await expect(page).toHaveURL('/');
    await expect(home.title).toHaveText('Routines & Goals');
  });

  test('the layout never scrolls sideways', async () => {
    await expect(home.title).toBeVisible();

    expect(await home.horizontalOverflow()).toBe(0);
  });
});
