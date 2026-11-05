import { expect, test } from '@playwright/test';
import { InvestmentsPage } from './pages/investments.page';
import { ownMonth, uniqueName } from './support/finances-api';

/*
 * The portfolio is one for the whole app, so each test tells its own investment apart by a unique name
 * and never reads the totals. The clock is fixed so purchases are dated in a month of their own.
 */
const FIRST_SLOT = 50;

let investments: InvestmentsPage;

test.beforeEach(async ({ page }) => {
  investments = new InvestmentsPage(page);
});

test('the Investments tab opens the page', async ({ page }) => {
  await page.goto('/finances/transactions');

  await page.getByRole('link', { name: 'Investments' }).click();

  await expect(page).toHaveURL(/\/finances\/investments$/);
  await expect(investments.title).toHaveText('Investments');
});

test('a purchase is valued at the typed price and kept after a reload', async ({ page }) => {
  const name = uniqueName(test.info(), 'PETR');
  await page.clock.setFixedTime(ownMonth(test.info(), FIRST_SLOT));
  await investments.goto();

  await investments.addInvestment(name, '12,00');
  await investments.trade(name, 'Buy', '10', '10,00');

  const holding = investments.holding(name);
  await expect(holding).toContainText('10 units · average R$10.00');
  await expect(holding).toContainText('R$120.00');
  await expect(holding).toContainText('+R$20.00 (+20.00%)');
  await page.reload();
  await expect(investments.holding(name)).toContainText('+R$20.00 (+20.00%)');
  expect(await investments.horizontalOverflow()).toBe(0);
});

test('selling more than was held is refused and the form stays open', async ({ page }) => {
  const name = uniqueName(test.info(), 'ITSA');
  await page.clock.setFixedTime(ownMonth(test.info(), FIRST_SLOT + 1));
  await investments.goto();
  await investments.addInvestment(name, '10,00');
  await investments.trade(name, 'Buy', '5', '10,00');
  await expect(investments.holding(name)).toContainText('5 units');

  await investments.trade(name, 'Sell', '50', '10,00');

  await expect(page.getByRole('form', { name: `Trade ${name}` })).toBeVisible();
  await expect(investments.holding(name)).toContainText('5 units');
});

test('proventos are listed with the movements and a purchase can be deleted', async ({ page }) => {
  const name = uniqueName(test.info(), 'MXRF');
  await page.clock.setFixedTime(ownMonth(test.info(), FIRST_SLOT + 2));
  await investments.goto();
  await investments.addInvestment(name, '10,00');
  await investments.trade(name, 'Buy', '3', '10,00');
  await expect(investments.holding(name)).toContainText('3 units');

  await investments.addIncome(name, '4,50');

  await expect(investments.movements(name)).toHaveCount(2);
  await expect(investments.movements(name).filter({ hasText: 'Dividend' })).toContainText(
    '+R$4.50',
  );
  const deleted = page.waitForResponse(
    (response) => response.request().method() === 'DELETE' && response.ok(),
  );
  await page.getByRole('button', { name: `Delete Buy 3 of ${name}` }).click();
  await deleted;
  await expect(investments.movements(name)).toHaveCount(1);
  await expect(investments.holding(name)).toContainText('No units held');
});
