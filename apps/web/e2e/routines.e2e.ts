import { Page, expect, test } from '@playwright/test';
import { HomePage } from './pages/home.page';
import { RoutinesPage } from './pages/routines.page';
import {
  completeBlock,
  createCategory,
  createCategorizedTask,
  createDailyTask,
  createObjective,
  createRoutine,
  createWeeklyGoal,
  localDay,
  localToday,
  SeededRoutine,
  uniqueTitle,
} from './support/routines-api';

let routines: RoutinesPage;

/** Selects a routine tab and waits until the editor shows its single block. */
async function openRoutine(page: Page, routine: SeededRoutine): Promise<void> {
  await page.getByRole('tab', { name: routine.name }).click();
  const blockNames = page.getByRole('textbox', { name: 'Block name' });
  // Count first: it retries until the editor re-renders, while a strict-mode match fails at once.
  await expect(blockNames).toHaveCount(1);
  await expect(blockNames).toHaveValue(routine.blockName);
}

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
  test('a task added with + repeats daily, keeps its category and survives a reload', async ({
    page,
  }) => {
    const title = uniqueTitle('Practice English');
    await routines.goto();
    const tasksCard = page.getByRole('region', { name: "Today's tasks" });
    const saved = page.waitForResponse(
      (response) => response.url().includes('/api/tasks/') && response.request().method() === 'PUT',
    );

    await tasksCard.getByRole('button', { name: 'New task' }).click();
    const form = tasksCard.getByRole('form', { name: 'New task' });
    await form.getByLabel('Task').fill(title);
    await form.getByLabel('Category').selectOption({ label: 'Study' });
    await form.getByRole('button', { name: 'Every day' }).click();
    await form.getByRole('button', { name: 'Add task' }).click();
    await saved;
    await page.reload();

    const row = tasksCard.getByRole('listitem').filter({ hasText: title });
    await expect(row).toContainText('Every day');
    await expect(row).toContainText('Study');
  });

  test('completing the running block marks it done and moves the next one up', async ({ page }) => {
    // 14:10 on a Monday, in the sample "C# study" (13:30–15:00). A random far-off week keeps
    // runs and browser projects from sharing a day, since outcomes are stored per date.
    const monday = new Date(2030, 0, 7 + 7 * Math.floor(Math.random() * 2000), 14, 10);
    await page.clock.setFixedTime(monday);
    await routines.goto();
    const nowCard = page.getByRole('region', { name: 'C# study' });
    const recorded = page.waitForResponse((response) => response.url().includes('/days/'));

    await nowCard.getByRole('button', { name: 'Complete block' }).click();
    await recorded;
    await page.reload();

    await expect(page.getByRole('heading', { level: 2, name: 'Networking' })).toBeVisible();
    const study = page
      .getByRole('list', { name: 'Blocks of the day' })
      .getByRole('listitem')
      .filter({ hasText: 'C# study' });
    await expect(study).toContainText('Done');
    await expect(study).toContainText('13:30 – 14:10');
  });

  test('a skipped block can be undone and stays back on plan after a reload', async ({ page }) => {
    const monday = new Date(2030, 0, 7 + 7 * Math.floor(Math.random() * 2000), 14, 10);
    await page.clock.setFixedTime(monday);
    await routines.goto();
    const skipped = page.waitForResponse((response) => response.url().includes('/days/'));
    // Exact: every timeline block also has a "Skip <block name>" button.
    await page.getByRole('button', { name: 'Skip', exact: true }).click();
    await skipped;
    const undone = page.waitForResponse(
      (response) => response.url().includes('/days/') && response.request().method() === 'DELETE',
    );

    await page.getByRole('button', { name: 'Undo C# study' }).click();
    await undone;
    await page.reload();

    await expect(page.getByRole('heading', { level: 2, name: 'C# study' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Undo C# study' })).toHaveCount(0);
  });

  test('an edited task keeps its new title and category after a reload', async ({
    page,
    request,
  }) => {
    const task = await createDailyTask(request);
    const renamed = uniqueTitle('Stretch and breathe');
    await routines.goto();
    const tasksCard = page.getByRole('region', { name: "Today's tasks" });
    const saved = page.waitForResponse(
      (response) => response.request().method() === 'PUT' && response.url().includes('/api/tasks/'),
    );

    await tasksCard.getByRole('button', { name: `Edit ${task.title}` }).click();
    const form = tasksCard.getByRole('form', { name: 'Edit task' });
    await form.getByLabel('Task').fill(renamed);
    await form.getByLabel('Category').selectOption({ label: 'Study' });
    await form.getByRole('button', { name: 'Save task' }).click();
    await saved;
    await page.reload();

    const row = tasksCard.getByRole('listitem').filter({ hasText: renamed });
    await expect(row).toContainText('Study');
    await expect(tasksCard.getByText(task.title, { exact: true })).toHaveCount(0);
  });

  test('a one-time task scheduled for another day waits in "Not today" and shows up on that day', async ({
    page,
  }) => {
    const title = uniqueTitle('Renew the passport');
    // A far-off random day, so runs and browser projects do not share one and nothing else is due.
    const day = new Date(2031, 0, 6 + Math.floor(Math.random() * 300), 9, 0);
    const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    await routines.goto();
    const tasksCard = page.getByRole('region', { name: "Today's tasks" });
    const saved = page.waitForResponse(
      (response) => response.request().method() === 'PUT' && response.url().includes('/api/tasks/'),
    );

    await tasksCard.getByRole('button', { name: 'New task' }).click();
    const form = tasksCard.getByRole('form', { name: 'New task' });
    await form.getByLabel('Task').fill(title);
    await form.getByLabel('On').fill(iso);
    await form.getByRole('button', { name: 'Add task' }).click();
    await saved;

    const waiting = tasksCard.getByRole('list', { name: 'Tasks not due today' });
    await expect(waiting.getByRole('listitem').filter({ hasText: title })).toBeVisible();
    await expect(tasksCard.getByRole('checkbox', { name: title })).toHaveCount(0);

    await page.clock.setFixedTime(day);
    await page.reload();
    await expect(tasksCard.getByRole('checkbox', { name: title })).toBeVisible();
  });

  test('checking a task off is kept after a reload', async ({ page, request }) => {
    const task = await createDailyTask(request);
    await routines.goto();
    const checkbox = page.getByRole('checkbox', { name: task.title });
    const marked = page.waitForResponse((response) => response.url().includes('/completions/'));

    await checkbox.check();
    await marked;
    await page.reload();

    await expect(checkbox).toBeChecked();
  });
});

test.describe('routine editor', () => {
  test('adding a block lists it in the editor', async ({ page }) => {
    await routines.goto('/routines/routine');

    await page.getByRole('button', { name: 'Add block' }).click();

    await expect(page.getByRole('textbox', { name: 'Block name' }).last()).toHaveValue('New block');
  });

  test('"New routine" creates a routine that survives a reload', async ({ page }) => {
    const name = uniqueTitle('Night');
    await routines.goto('/routines/routine');

    await page.getByRole('button', { name: 'New routine' }).click();
    await page.getByLabel('Routine name').fill(name);
    await page.getByLabel('Routine name').blur();
    await page.getByRole('button', { name: 'Save routine' }).click();

    await expect(page.getByText('All changes saved')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('tab', { name })).toBeVisible();
  });

  test('a deleted routine stays gone after a reload', async ({ page, request }) => {
    const routine = await createRoutine(request);
    await routines.goto('/routines/routine');
    await openRoutine(page, routine);
    const deleted = page.waitForResponse(
      (response) => response.url().endsWith(routine.id) && response.request().method() === 'DELETE',
    );

    await page.getByRole('button', { name: 'Delete routine' }).click();
    await page
      .getByRole('group', { name: 'Confirm deletion' })
      .getByRole('button', { name: 'Delete' })
      .click();

    await expect(page.getByRole('tab', { name: routine.name })).toHaveCount(0);
    await deleted;
    await page.reload();
    await expect(page.getByRole('tab', { name: 'Weekdays' })).toBeVisible();
    await expect(page.getByRole('tab', { name: routine.name })).toHaveCount(0);
  });

  test('a block linked to a new category survives a reload', async ({ page, request }) => {
    const category = await createCategory(request, 'Languages');
    const routine = await createRoutine(request);
    await routines.goto('/routines/routine');
    await openRoutine(page, routine);
    const blockCategory = page.getByRole('combobox', { name: 'Category' });

    await blockCategory.selectOption({ label: category.name });
    await page.getByRole('button', { name: 'Save routine' }).click();

    await expect(page.getByText('All changes saved')).toBeVisible();
    await page.reload();
    await openRoutine(page, routine);
    await expect(blockCategory).toHaveValue(category.id);
  });
});

test.describe('categories & goals', () => {
  test('a created category opens with the goal form and survives a reload', async ({ page }) => {
    const name = uniqueTitle('Languages');
    await routines.goto('/routines/categories');

    await page.getByRole('button', { name: 'New category' }).click();
    await page.getByLabel('Category name').fill(name);
    // The category opens before the API answers; reloading earlier would abort the request.
    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/categories') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    await expect(routines.title).toHaveText(name);
    await expect(page.getByRole('form', { name: 'Set a new goal' })).toBeVisible();
    await saved;
    await page.reload();
    await expect(routines.title).toHaveText(name);
  });

  test('a created goal adds its card and survives a reload', async ({ page }) => {
    const title = uniqueTitle('Read before bed');
    await routines.goto('/routines/categories/reading');

    await page.getByRole('button', { name: 'New goal' }).click();
    await page.getByLabel('Goal name').fill(title);
    // The card appears before the API answers; reloading earlier would abort the request.
    const saved = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/goals' && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Create goal' }).click();

    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await saved;
    await page.reload();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  });

  test('a completed block of the category counts toward its goal', async ({ page, request }) => {
    // Its own category: a completed block counts toward every frequency goal of its category, so
    // sharing one with other tests (they run in parallel) would credit them by accident.
    const category = await createCategory(request, 'Strength');
    const goal = await createWeeklyGoal(request, category.id, 3);
    const routine = await createRoutine(request, category.id);

    await completeBlock(request, routine, localToday());
    await routines.goto(`/routines/categories/${category.id}`);

    const card = page.getByRole('article').filter({ hasText: goal.title });
    await expect(card.getByText('1 of 3 times')).toBeVisible();
    await expect(card.getByRole('button', { name: '+1' })).toHaveCount(0);
  });

  test('an objective marked achieved stays achieved after a reload', async ({ page, request }) => {
    const goal = await createObjective(request, 'exercise');
    await routines.goto('/routines/categories/exercise');
    const card = page.getByRole('article').filter({ hasText: goal.title });
    // The mark shows before the API answers; reloading earlier would abort the request.
    const marked = page.waitForResponse((response) => response.url().endsWith('/achievement'));

    await card.getByRole('button', { name: 'Mark achieved' }).click();
    await marked;
    await page.reload();

    await expect(card.getByRole('button', { name: 'Achieved', exact: true })).toBeVisible();
  });

  test('an edited goal keeps its new name and target after a reload', async ({ page, request }) => {
    const goal = await createWeeklyGoal(request, 'exercise', 3);
    const renamed = uniqueTitle('Lift weights');
    await routines.goto('/routines/categories/exercise');
    const saved = page.waitForResponse(
      (response) => response.request().method() === 'PUT' && response.url().includes('/api/goals/'),
    );

    await page.getByRole('button', { name: `Edit ${goal.title}` }).click();
    const form = page.getByRole('form', { name: 'Edit goal' });
    await form.getByLabel('Goal name').fill(renamed);
    await form.getByLabel('How many times').fill('4');
    await form.getByLabel('How many times').blur();
    await form.getByRole('button', { name: 'Save goal' }).click();
    await saved;
    await page.reload();

    const card = page.getByRole('article').filter({ hasText: renamed });
    await expect(card.getByText('0 of 4 times')).toBeVisible();
  });

  test('a deleted goal stays gone after a reload', async ({ page, request }) => {
    const goal = await createWeeklyGoal(request, 'exercise', 3);
    await routines.goto('/routines/categories/exercise');
    const deleted = page.waitForResponse((response) => response.request().method() === 'DELETE');

    await page.getByRole('button', { name: `Delete ${goal.title}` }).click();
    await page
      .getByRole('group', { name: 'Confirm deletion' })
      .getByRole('button', { name: 'Delete' })
      .click();
    await deleted;
    await page.reload();

    await expect(page.getByRole('heading', { name: goal.title })).toHaveCount(0);
  });

  test('checking a task off does not count toward goals', async ({ page, request }) => {
    const category = await createCategory(request, 'Mobility');
    const goal = await createWeeklyGoal(request, category.id, 3);
    const task = await createCategorizedTask(request, category.id);
    await routines.goto();
    const marked = page.waitForResponse((response) => response.url().includes('/completions/'));

    await page.getByRole('checkbox', { name: task.title }).check();
    await marked;
    await routines.goto(`/routines/categories/${category.id}`);

    const card = page.getByRole('article').filter({ hasText: goal.title });
    await expect(card.getByText('0 of 3 times')).toBeVisible();
  });
});

test.describe('history', () => {
  test('shows a block completed on a past day and the goal it met', async ({ page, request }) => {
    const category = await createCategory(request, 'Focus');
    const goal = await createWeeklyGoal(request, category.id, 1);
    const routine = await createRoutine(request, category.id);
    const yesterday = localDay(-1);
    await completeBlock(request, routine, yesterday);

    await routines.goto('/routines/history');
    await page.getByLabel('Day to show').fill(yesterday);

    const blocks = page.getByRole('region', { name: 'Blocks completed' });
    await expect(blocks.getByText(routine.name)).toBeVisible();
    const goals = page.getByRole('region', { name: 'Goals met' });
    await expect(goals.getByText(goal.title)).toBeVisible();
  });
});
