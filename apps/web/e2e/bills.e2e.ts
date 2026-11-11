import { expect, test } from './support/test';
import { BillsPage } from './pages/bills.page';
import {
  createAccount,
  createTransaction,
  isoDayOf,
  ownMonth,
  uniqueName,
} from './support/finances-api';

/*
 * Slots 0–3 belong to the Transactions tests, 10–12 to Banks & Cards and 20+ to Income split: a
 * transaction recorded here in one of their months would change the totals they check. Bills are not
 * per month, so each test tells its own apart by a unique description.
 */
const FIRST_SLOT = 30;

let bills: BillsPage;

test.beforeEach(async ({ page }) => {
  bills = new BillsPage(page);
});

test('the To pay & receive tab opens the page', async ({ page }) => {
  await page.goto('/finances/transactions');

  await page.getByRole('link', { name: 'To pay & receive' }).click();

  await expect(page).toHaveURL(/\/finances\/bills$/);
  await expect(bills.title).toHaveText('To pay & receive');
});

test('a bill due soon is marked paid and becomes an expense', async ({ page, request }) => {
  const moment = ownMonth(test.info(), FIRST_SLOT);
  const description = uniqueName(test.info(), 'Internet');
  await page.clock.setFixedTime(moment);
  await bills.goto();

  await bills.addBill({
    description,
    amount: '119,90',
    category: 'Housing',
    dueDate: isoDayOf(moment, 17),
  });
  await expect(bills.group('Next 7 days').getByText(description)).toBeVisible();
  await bills.settle('Mark paid', description);

  await expect(bills.group(/^Paid & received/).getByText(description)).toBeVisible();
  await expect(bills.group('Next 7 days').getByText(description)).toHaveCount(0);
  const month = isoDayOf(moment, 1).slice(0, 7);
  const response = await request.get(`/api/transactions?month=${month}`);
  const transactions = (await response.json()) as { description: string; amountCents: number }[];
  expect(transactions.find((item) => item.description === description)?.amountCents).toBe(-11990);
});

test('a bill kept past its due date is overdue, and undoing a payment brings it back', async ({
  page,
}) => {
  const moment = ownMonth(test.info(), FIRST_SLOT + 1);
  const description = uniqueName(test.info(), 'Rent');
  await page.clock.setFixedTime(moment);
  await bills.goto();

  await bills.addBill({
    description,
    amount: '1500',
    category: 'Housing',
    dueDate: isoDayOf(moment, 10),
  });
  await expect(bills.group('Overdue').getByText(description)).toBeVisible();
  await bills.settle('Mark paid', description);
  await bills.undo(description);

  await expect(bills.group('Overdue').getByText(description)).toBeVisible();
  await page.reload();
  await expect(bills.group('Overdue').getByText(description)).toBeVisible();
});

test('installments are listed one by one with their place in the series', async ({ page }) => {
  const moment = ownMonth(test.info(), FIRST_SLOT + 2);
  const description = uniqueName(test.info(), 'Course');
  await page.clock.setFixedTime(moment);
  await bills.goto();

  await bills.addBill({
    description,
    amount: '90',
    category: 'Education',
    dueDate: isoDayOf(moment, 17),
    repeat: { option: 'Monthly installments', count: '3' },
  });

  await expect(bills.rows(description)).toHaveCount(3);
  await expect(bills.rows(description).nth(0)).toContainText('Installment 1/3');
  await expect(bills.rows(description).nth(2)).toContainText('Installment 3/3');
  expect(await bills.horizontalOverflow()).toBe(0);
});

test('a card invoice is listed with the bills and leaves once paid', async ({ page, request }) => {
  const moment = ownMonth(test.info(), FIRST_SLOT + 3);
  const cardName = uniqueName(test.info(), 'Card');
  const cardId = await createAccount(request, {
    name: cardName,
    kind: 'creditCard',
    openingBalanceCents: 0,
    card: { limitCents: 500000, closingDay: 20, dueDay: 27 },
  });
  await createTransaction(request, {
    date: isoDayOf(moment, 10),
    description: 'Groceries',
    categoryId: 'food',
    accountId: cardId,
    amountCents: -28640,
  });
  await page.clock.setFixedTime(moment);
  await bills.goto();

  await expect(bills.rows(`${cardName} invoice`)).toContainText('R$286.40');
  await page.getByRole('button', { name: `Pay invoice: ${cardName} invoice` }).click();
  await page
    .getByRole('form', { name: `Pay ${cardName}` })
    .getByRole('button', { name: 'Record payment' })
    .click();

  await expect(bills.rows(`${cardName} invoice`)).toHaveCount(0);
  await page.reload();
  await expect(bills.rows(`${cardName} invoice`)).toHaveCount(0);
});
