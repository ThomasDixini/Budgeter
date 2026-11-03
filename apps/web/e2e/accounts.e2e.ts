import { expect, test } from '@playwright/test';
import { AccountsPage } from './pages/accounts.page';
import {
  createAccount,
  createTransaction,
  isoDayOf,
  ownMonth,
  uniqueName,
} from './support/finances-api';

/*
 * Slots 0–3 belong to the Transactions tests: a purchase recorded here in one of their months would
 * change the totals they check.
 */
const FIRST_SLOT = 10;

let accounts: AccountsPage;

test.beforeEach(async ({ page }) => {
  accounts = new AccountsPage(page);
});

test('the Banks & Cards tab opens the page', async ({ page }) => {
  await page.goto('/finances/transactions');

  await page.getByRole('link', { name: 'Banks & Cards' }).click();

  await expect(page).toHaveURL(/\/finances\/accounts$/);
  await expect(accounts.title).toHaveText('Banks & Cards');
});

test('adding a bank account shows its opening balance', async ({ page }) => {
  await page.clock.setFixedTime(ownMonth(test.info(), FIRST_SLOT));
  const name = uniqueName(test.info(), 'Wallet');
  await accounts.goto();

  await accounts.addBankAccount(name, '250,00');

  await expect(accounts.tile(name)).toContainText('R$250.00');
  await expect(accounts.detail.getByRole('heading', { level: 2 })).toHaveText(name);
  await page.reload();
  await expect(accounts.tile(name)).toContainText('R$250.00');
});

test('paying a card invoice moves the money from the bank account', async ({ page, request }) => {
  const moment = ownMonth(test.info(), FIRST_SLOT + 1);
  const bankName = uniqueName(test.info(), 'Bank');
  const cardName = uniqueName(test.info(), 'Card');
  await createAccount(request, {
    name: bankName,
    kind: 'bankAccount',
    openingBalanceCents: 100000,
  });
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
  await accounts.goto();

  await accounts.tile(cardName).click();
  await expect(accounts.stat('Current invoice')).toHaveText('R$286.40');
  await accounts.detail.getByRole('button', { name: 'Pay invoice' }).click();
  const form = accounts.paymentForm(cardName);
  await expect(form.getByLabel('Amount (R$)')).toHaveValue('286.40');
  await form.getByLabel('Paid from').selectOption({ label: bankName });
  await form.getByRole('button', { name: 'Record payment' }).click();

  await expect(accounts.stat('Available limit')).toHaveText('R$5,000.00');
  await expect(accounts.tile(bankName)).toContainText('R$713.60');
});

test('the page fits a phone screen without sideways scrolling', async ({ page }) => {
  await page.clock.setFixedTime(ownMonth(test.info(), FIRST_SLOT + 2));
  await accounts.goto();
  await expect(accounts.tiles).toBeVisible();

  expect(await accounts.horizontalOverflow()).toBe(0);
});
