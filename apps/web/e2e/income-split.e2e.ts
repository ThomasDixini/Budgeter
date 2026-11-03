import { expect, test } from '@playwright/test';
import { IncomeSplitPage } from './pages/income-split.page';
import {
  createAccount,
  createFinanceCategory,
  createTransaction,
  isoDayOf,
  ownMonth,
  uniqueName,
} from './support/finances-api';

/*
 * Slots 0–3 belong to the Transactions tests and 10–12 to Banks & Cards: a purchase recorded here in
 * one of their months would change the totals they check.
 */
const FIRST_SLOT = 20;

let split: IncomeSplitPage;

test.beforeEach(async ({ page }) => {
  split = new IncomeSplitPage(page);
});

test('the Income split tab opens the page', async ({ page }) => {
  await page.goto('/finances/transactions');

  await page.getByRole('link', { name: 'Income split' }).click();

  await expect(page).toHaveURL(/\/finances\/income-split$/);
  await expect(split.title).toHaveText('Income split');
});

/*
 * The split is one plan for the whole app, so the tests that save it run one after another and on one
 * browser project only: the two projects would otherwise overwrite each other's plan.
 */
test.describe('saving the plan', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(() => {
    test.skip(test.info().project.name !== 'desktop', 'one shared plan');
  });

  test('a template with a base income is kept after a reload', async ({ page }) => {
    await split.goto();

    await split.applyTemplate('50 · 30 · 20');
    await split.baseIncome.fill('9500');
    await expect(split.status).toHaveText('100% assigned');
    const saved = page.waitForResponse((response) => response.request().method() === 'PUT');
    await split.saveButton.click();
    await saved;
    await expect(split.saveButton).toBeDisabled();
    await page.reload();

    await expect(split.baseIncome).toHaveValue('9500.00');
    await expect(split.status).toHaveText('100% assigned');
    await expect(split.part('Needs')).toContainText('R$4,750.00');
  });

  test('editing a saved plan says what is left and saves the new percentages', async ({ page }) => {
    await split.goto();
    await split.part('Wants').getByLabel('Percentage number of Wants').fill('20');

    await expect(split.status).toContainText('10% left');
    const saved = page.waitForResponse((response) => response.request().method() === 'PUT');
    await split.saveButton.click();
    await saved;
    await expect(split.saveButton).toBeDisabled();
    await page.reload();

    await expect(split.status).toContainText('10% left');
  });
});

test('spending in a part category shows against what was planned', async ({ page, request }) => {
  const moment = ownMonth(test.info(), FIRST_SLOT);
  const categoryName = uniqueName(test.info(), 'Courses');
  const categoryId = await createFinanceCategory(request, categoryName);
  const accountName = uniqueName(test.info(), 'Bank');
  const accountId = await createAccount(request, {
    name: accountName,
    kind: 'bankAccount',
    openingBalanceCents: 0,
  });
  await createTransaction(request, {
    date: isoDayOf(moment, 4),
    description: 'Course fee',
    categoryId,
    accountId,
    amountCents: -25000,
  });
  await page.clock.setFixedTime(moment);
  await split.goto();

  await split.applyTemplate('50 · 30 · 20');
  await split.baseIncome.fill('1000');
  await split.assignCategory('Wants', categoryName);

  const wants = split.comparison.getByRole('listitem').filter({ hasText: 'Wants' });
  await expect(wants).toContainText('83% used');
  await expect(wants).toContainText('R$250.00');
  await expect(wants).toContainText('of R$300.00');
});

test('a category can be created, renamed and deleted', async ({ page }) => {
  const created = uniqueName(test.info(), 'Gym');
  const renamed = uniqueName(test.info(), 'Fitness');
  await split.goto();

  await split.addCategory(created);
  await expect(split.categoryItem(created)).toBeVisible();
  await page.reload();
  await expect(split.categoryItem(created)).toBeVisible();

  await split.categories.getByRole('button', { name: `Rename ${created}` }).click();
  await split.categories.getByLabel('Category name').fill(renamed);
  await split.categories.getByRole('button', { name: 'Save' }).click();
  await expect(split.categoryItem(renamed)).toBeVisible();

  await split.categories.getByRole('button', { name: `Delete ${renamed}` }).click();
  await expect(split.categoryItem(renamed)).toHaveCount(0);
  await page.reload();
  await expect(split.categoryItem(renamed)).toHaveCount(0);
});

test('a category with transactions cannot be deleted and comes back with a notice', async ({
  page,
  request,
}) => {
  const moment = ownMonth(test.info(), FIRST_SLOT + 1);
  const categoryName = uniqueName(test.info(), 'Pets');
  const categoryId = await createFinanceCategory(request, categoryName);
  const accountId = await createAccount(request, {
    name: uniqueName(test.info(), 'Bank'),
    kind: 'bankAccount',
    openingBalanceCents: 0,
  });
  await createTransaction(request, {
    date: isoDayOf(moment, 6),
    description: 'Vet',
    categoryId,
    accountId,
    amountCents: -9000,
  });
  await split.goto();

  await split.categories.getByRole('button', { name: `Delete ${categoryName}` }).click();

  await expect(split.categoryItem(categoryName)).toBeVisible();
  await expect(page.getByText(/Not saved:.*no transactions/)).toBeVisible();
});

test('the page fits a phone screen without sideways scrolling', async ({ page }) => {
  await page.clock.setFixedTime(ownMonth(test.info(), FIRST_SLOT + 2));
  await split.goto();
  await split.applyTemplate('60 · 20 · 10 · 10');
  await expect(split.parts).toBeVisible();

  expect(await split.horizontalOverflow()).toBe(0);
});
