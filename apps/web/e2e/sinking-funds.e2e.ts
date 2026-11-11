import { randomUUID } from 'node:crypto';
import { expect, test } from './support/test';
import { BillsPage } from './pages/bills.page';
import { SinkingFundsPage } from './pages/sinking-funds.page';
import { isoDayOf, ownMonth, uniqueName } from './support/finances-api';

/*
 * Slots 0–3 belong to the Transactions tests, 10–12 to Banks & Cards, 20+ to Income split, 30+ to
 * Bills and 50+ to Investments. Sinking funds live in one table shared by every test, so each test
 * tells its own apart by a unique description. Rolling turns every fund due on or before the page's
 * day into a bill, so the test that rolls owns the earliest slot: no other test's fund is due by then.
 */
const ROLL_SLOT = 60;
const FIRST_SLOT = 61;
const DUE_DAY = 20;

let funds: SinkingFundsPage;

test.beforeEach(async ({ page }) => {
  funds = new SinkingFundsPage(page);
});

/** The short date the list shows, like `Jan 20`. */
function shortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

test('a fund that repeats every few months shows what to set aside each month', async ({
  page,
}) => {
  const moment = ownMonth(test.info(), FIRST_SLOT);
  const description = uniqueName(test.info(), 'Grooming');
  const due = new Date(moment.getFullYear(), moment.getMonth() + 2, DUE_DAY);
  await page.clock.setFixedTime(moment);
  await funds.goto();

  await funds.addFund({
    description,
    category: 'Housing',
    cost: '100,00',
    schedule: { kind: 'everyMonths', intervalMonths: '2', nextDueDate: isoDayOf(due, DUE_DAY) },
  });

  await expect(funds.row(description)).toContainText('Set aside R$50.00 per month');
  await expect(funds.row(description)).toContainText(`Falls due ${shortDate(due)}`);
  await expect(funds.total).toBeVisible();
  await page.reload();
  await expect(funds.row(description)).toContainText('Set aside R$50.00 per month');
});

test('a fund on a fixed date each year spreads its cost over twelve months', async ({ page }) => {
  const moment = ownMonth(test.info(), FIRST_SLOT + 1);
  const description = uniqueName(test.info(), 'IPVA');
  const due = new Date(moment.getFullYear(), moment.getMonth() + 3, DUE_DAY);
  await page.clock.setFixedTime(moment);
  await funds.goto();

  await funds.addFund({
    description,
    category: 'Housing',
    cost: '100,00',
    schedule: { kind: 'fixedDate', month: String(due.getMonth() + 1), day: String(DUE_DAY) },
  });

  await expect(funds.row(description)).toContainText('Set aside R$8.34 per month');
  await expect(funds.row(description)).toContainText(`Falls due ${shortDate(due)}`);
});

test('editing the cost updates the monthly amount and deleting removes the fund', async ({
  page,
}) => {
  const moment = ownMonth(test.info(), FIRST_SLOT + 2);
  const description = uniqueName(test.info(), 'Insurance');
  const due = new Date(moment.getFullYear(), moment.getMonth() + 2, DUE_DAY);
  await page.clock.setFixedTime(moment);
  await funds.goto();
  await funds.addFund({
    description,
    category: 'Housing',
    cost: '100,00',
    schedule: { kind: 'everyMonths', intervalMonths: '2', nextDueDate: isoDayOf(due, DUE_DAY) },
  });

  await funds.changeCost(description, '300,00');

  await expect(funds.row(description)).toContainText('Set aside R$150.00 per month');
  await funds.remove(description);
  await expect(funds.row(description)).toHaveCount(0);
  await page.reload();
  await expect(funds.section).toBeVisible();
  await expect(funds.row(description)).toHaveCount(0);
});

test('a fund due today becomes a bill in the agenda', async ({ page, request }) => {
  const moment = ownMonth(test.info(), ROLL_SLOT);
  const description = uniqueName(test.info(), 'Vet');
  const today = isoDayOf(moment, moment.getDate());
  const response = await request.put(`/api/sinking-funds/${randomUUID()}?today=${today}`, {
    data: {
      description,
      categoryId: 'housing',
      amountCents: 12000,
      schedule: { kind: 'everyMonths', intervalMonths: 3, nextDueDate: today },
    },
  });
  expect(response.ok()).toBe(true);
  await page.clock.setFixedTime(moment);
  const bills = new BillsPage(page);

  await bills.goto();

  await expect(bills.group('Next 7 days').getByText(description)).toBeVisible();
});

test('the page fits a phone screen without sideways scrolling', async ({ page }) => {
  const moment = ownMonth(test.info(), FIRST_SLOT + 3);
  const description = uniqueName(test.info(), 'Long running sinking fund name');
  const due = new Date(moment.getFullYear(), moment.getMonth() + 2, DUE_DAY);
  await page.clock.setFixedTime(moment);
  await funds.goto();
  await funds.addFund({
    description,
    category: 'Housing',
    cost: '1500,00',
    schedule: { kind: 'everyMonths', intervalMonths: '6', nextDueDate: isoDayOf(due, DUE_DAY) },
  });
  await expect(funds.row(description)).toBeVisible();

  expect(await funds.horizontalOverflow()).toBe(0);
});
