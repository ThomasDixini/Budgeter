import { expect, test } from '@playwright/test';
import { HomePage } from './pages/home.page';
import { RoutinesPage } from './pages/routines.page';
import { createWeeklyGoal, uniqueTitle } from './support/routines-api';

let routines: RoutinesPage;

test.beforeEach(async ({ page }) => {
  routines = new RoutinesPage(page);
});

test.describe('entering the module', () => {
  test('Open module on the home wheel lands on Today', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();

    await home.openModuleLink.click();

    await expect(page).toHaveURL('/routines');
    await expect(routines.currentTab).toHaveText('Today');
    await expect(page.getByRole('heading', { name: 'Day timeline' })).toBeVisible();
  });

  test('the module dock leads back to the wheel', async ({ page }) => {
    await routines.goto();

    await routines.moduleDock.getByRole('link', { name: /Next module/ }).click();

    await expect(page).toHaveURL('/');
  });
});

test.describe('section tabs', () => {
  test('open the routine editor', async ({ page }) => {
    await routines.goto();

    await routines.openTab('Routine');

    await expect(page).toHaveURL('/routines/routine');
    await expect(routines.title).toHaveText('My routine');
  });

  test('open categories and keep the tab lit on a category', async ({ page }) => {
    await routines.goto();
    await routines.openTab('Categories & Goals');

    await page.getByRole('link', { name: /Study/ }).click();

    await expect(page).toHaveURL('/routines/categories/study');
    await expect(routines.title).toHaveText('Study');
    await expect(routines.currentTab).toHaveText('Categories & Goals');
  });

  test('pages never scroll sideways', async () => {
    await routines.goto('/routines/routine');
    await expect(routines.title).toBeVisible();

    expect(await routines.horizontalOverflow()).toBe(0);
  });
});

test.describe('today', () => {
  test('checking a task updates the counter', async ({ page }) => {
    await routines.goto();

    await page.getByRole('checkbox', { name: 'Do the LINQ exercises' }).check();

    const tasksCard = page.getByRole('region', { name: "Today's tasks" });
    await expect(tasksCard.getByText('3/5', { exact: true })).toBeVisible();
  });
});

test.describe('routine editor', () => {
  test('adding a block lists it in the editor', async ({ page }) => {
    await routines.goto('/routines/routine');

    await page.getByRole('button', { name: 'Add block' }).click();

    await expect(page.getByRole('textbox', { name: 'Block name' }).last()).toHaveValue('New block');
  });
});

test.describe('categories & goals', () => {
  test('a created category opens with the goal form and survives a reload', async ({ page }) => {
    const name = uniqueTitle('Languages');
    await routines.goto('/routines/categories');

    await page.getByRole('button', { name: 'New category' }).click();
    await page.getByLabel('Category name').fill(name);
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    await expect(routines.title).toHaveText(name);
    await expect(page.getByRole('form', { name: 'Set a new goal' })).toBeVisible();
    await page.reload();
    await expect(routines.title).toHaveText(name);
  });

  test('a created goal adds its card and survives a reload', async ({ page }) => {
    const title = uniqueTitle('Read before bed');
    await routines.goto('/routines/categories/reading');

    await page.getByRole('button', { name: 'New goal' }).click();
    await page.getByLabel('Goal name').fill(title);
    await page.getByRole('button', { name: 'Create goal' }).click();

    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  });

  test('+1 logs progress on a goal and keeps it', async ({ page, request }) => {
    const goal = await createWeeklyGoal(request, 'exercise', 3);
    await routines.goto('/routines/categories/exercise');
    const card = page.getByRole('article').filter({ hasText: goal.title });

    await page.getByRole('button', { name: `Log progress on ${goal.title}` }).click();

    await expect(card.getByText('1 of 3 times')).toBeVisible();
    await page.reload();
    await expect(card.getByText('1 of 3 times')).toBeVisible();
  });
});
