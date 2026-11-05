import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createAccount, uniqueName } from './support/finances-api';

test('the Net worth tab opens the page', async ({ page }) => {
  await page.goto('/finances/transactions');

  await page.getByRole('link', { name: 'Net worth' }).click();

  await expect(page).toHaveURL(/\/finances\/net-worth$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Net worth');
});

/*
 * Net worth adds up every account and investment of the app, which other tests change at the same time,
 * so the test reads only the lines of what it created.
 */
test('a bank account, an investment and a card each show on their own list', async ({
  page,
  request,
}) => {
  const bankName = uniqueName(test.info(), 'Savings');
  const cardName = uniqueName(test.info(), 'Card');
  const investmentName = uniqueName(test.info(), 'FUND');
  const investmentId = randomUUID();
  await createAccount(request, {
    name: bankName,
    kind: 'bankAccount',
    openingBalanceCents: 250000,
  });
  await createAccount(request, {
    name: cardName,
    kind: 'creditCard',
    openingBalanceCents: 0,
    card: { limitCents: 500000, closingDay: 20, dueDay: 27 },
  });
  const saved = await request.put(`/api/investments/${investmentId}`, {
    data: { name: investmentName, kind: 'fund', price: { cents: 1500, on: '2031-01-15' } },
  });
  expect(saved.ok()).toBe(true);
  const bought = await request.put(`/api/investment-trades/${randomUUID()}`, {
    data: {
      investmentId,
      date: '2031-01-15',
      kind: 'buy',
      quantityThousandths: 4000,
      unitPriceCents: 1500,
    },
  });
  expect(bought.ok()).toBe(true);

  await page.goto('/finances/net-worth');

  await expect(page.getByRole('region', { name: 'Bank accounts' })).toContainText(
    `${bankName}R$2,500.00`,
  );
  await expect(page.getByRole('region', { name: 'Investments' })).toContainText(
    `${investmentName}R$60.00`,
  );
  await expect(page.getByRole('region', { name: 'Credit cards' })).toContainText(
    `${cardName}R$0.00`,
  );
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});
