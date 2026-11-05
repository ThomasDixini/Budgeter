import { expect, test } from '@playwright/test';
import { FinancesPage } from './pages/finances.page';
import { HomePage } from './pages/home.page';
import { createTransaction, isoDayOf, ownMonth } from './support/finances-api';

let finances: FinancesPage;

test.beforeEach(async ({ page }) => {
  finances = new FinancesPage(page);
});

test('Open module on the home wheel lands on the Overview', async ({ page }) => {
  const home = new HomePage(page);
  await home.goto();
  await home.spinRight();

  await home.openModuleLink.click();

  await expect(page).toHaveURL(/\/finances\/overview$/);
  await expect(finances.title).toHaveText('Overview');
});

test('recording an expense lists it, counts it and keeps it after a reload', async ({ page }) => {
  await page.clock.setFixedTime(ownMonth(test.info(), 0));
  await finances.goto();
  const saved = page.waitForResponse((response) => response.request().method() === 'PUT');

  await finances.recordExpense('286,40', 'Groceries', 'Food');
  await saved;

  await expect(finances.row('Groceries')).toBeVisible();
  await expect(finances.summary).toContainText('R$286.40');
  await page.reload();
  await expect(finances.row('Groceries')).toBeVisible();
});

test('filters narrow the list by type and by account', async ({ page, request }) => {
  const moment = ownMonth(test.info(), 1);
  await createTransaction(request, {
    date: isoDayOf(moment, 5),
    description: 'Salary',
    categoryId: 'salary',
    accountId: 'checking-account',
    amountCents: 950000,
  });
  await createTransaction(request, {
    date: isoDayOf(moment, 10),
    description: 'Cinema',
    categoryId: 'leisure',
    accountId: 'credit-card',
    amountCents: -6800,
  });
  await page.clock.setFixedTime(moment);
  await finances.goto();

  await finances.typeFilter.getByRole('button', { name: 'Income' }).click();
  await expect(finances.row('Cinema')).toHaveCount(0);
  await expect(finances.row('Salary')).toBeVisible();

  await finances.typeFilter.getByRole('button', { name: 'All' }).click();
  await finances.accountFilter.getByRole('button', { name: 'Credit card' }).click();
  await expect(finances.row('Salary')).toHaveCount(0);
  await expect(finances.row('Cinema')).toBeVisible();
});

test('a transaction can be corrected and then deleted', async ({ page, request }) => {
  const moment = ownMonth(test.info(), 2);
  await createTransaction(request, {
    date: isoDayOf(moment, 3),
    description: 'Pharmacy',
    categoryId: 'health',
    accountId: 'checking-account',
    amountCents: -5890,
  });
  await page.clock.setFixedTime(moment);
  await finances.goto();

  await finances.row('Pharmacy').click();
  const editForm = finances.form('Edit transaction');
  await editForm.getByLabel('Amount (R$)').fill('60');
  await editForm.getByRole('button', { name: 'Save transaction' }).click();
  await expect(finances.row('Pharmacy')).toHaveAccessibleName(/−R\$60\.00$/);

  await finances.row('Pharmacy').click();
  await editForm.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText(/No transactions in \w+ \d{4} yet\./)).toBeVisible();
});

test('the page fits a phone screen without sideways scrolling', async ({ page }) => {
  await page.clock.setFixedTime(ownMonth(test.info(), 3));
  await finances.goto();
  await expect(finances.summary).toBeVisible();

  expect(await finances.horizontalOverflow()).toBe(0);
});
