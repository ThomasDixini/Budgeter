import { expect, test } from './support/test';
import { createTransaction, isoDayOf, ownMonth, uniqueName } from './support/finances-api';

/*
 * Slots 0–3 belong to the Transactions tests, 10–12 to Banks & Cards, 20+ to Income split and 30–33 to
 * To pay & receive. The overview reads the last six months, so it takes a month of its own.
 */
const SLOT = 40;

test('the Overview tab opens the page', async ({ page }) => {
  await page.goto('/finances/transactions');

  await page.getByRole('link', { name: 'Overview' }).click();

  await expect(page).toHaveURL(/\/finances\/overview$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Overview');
});

test('this month’s spending and latest transactions show up, and the page fits the screen', async ({
  page,
  request,
}) => {
  const moment = ownMonth(test.info(), SLOT);
  const description = uniqueName(test.info(), 'Dinner');
  await createTransaction(request, {
    date: isoDayOf(moment, 10),
    description,
    categoryId: 'food',
    accountId: 'checking-account',
    amountCents: -4590,
  });
  await page.clock.setFixedTime(moment);

  await page.goto('/finances/overview');

  const spending = page.getByRole('region', { name: 'Spending by category' });
  await expect(spending).toContainText('Food');
  await expect(spending).toContainText('R$45.90');
  await expect(page.getByRole('region', { name: 'Latest transactions' })).toContainText(
    description,
  );
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});
