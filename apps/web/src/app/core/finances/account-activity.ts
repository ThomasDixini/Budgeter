import { CardPayment, Invoice } from './account-statement';
import { Account, AccountKind } from './finance-references';
import { Transaction } from './transaction';
import { monthOfDay } from './transaction-month';

/** One line of an account's activity: a transaction, or a card invoice payment made from it. */
export interface AccountMovement {
  /** The transaction's or the payment's id. */
  readonly id: string;
  /** Local calendar day, `YYYY-MM-DD`. */
  readonly date: string;
  readonly description: string;
  /** Absent on card payments, which are not filed under a category. */
  readonly categoryId?: string;
  /** Signed as seen from the account: positive came in, negative went out. */
  readonly amountCents: number;
  readonly isCardPayment: boolean;
}

/** Money that came into and went out of an account, both as positive cents. */
export interface MoneyFlows {
  readonly inCents: number;
  readonly outCents: number;
}

/** What went out under one category, as positive cents. */
export interface CategorySpending {
  readonly categoryId: string;
  readonly cents: number;
}

/** What the accounts hold and what is owed on the cards, both as positive cents. */
export interface AccountTotals {
  readonly bankBalanceCents: number;
  readonly cardOwedCents: number;
}

/**
 * A bank account's transactions and the card invoices paid from it, in the month and up to today,
 * newest first.
 * @example bankMovements(transactions, payments, 'checking-account', { month: '2026-10', today: '2026-10-31' }, cardNames)
 */
export function bankMovements(
  transactions: readonly Transaction[],
  payments: readonly CardPayment[],
  accountId: string,
  span: { readonly month: string; readonly today: string },
  cardNames: ReadonlyMap<string, string>,
): AccountMovement[] {
  const inSpan = (date: string): boolean => monthOfDay(date) === span.month && date <= span.today;
  const received = transactions
    .filter((transaction) => transaction.accountId === accountId && inSpan(transaction.date))
    .map(transactionMovement);
  const paidOut = payments
    .filter((payment) => payment.fromAccountId === accountId && inSpan(payment.date))
    .map((payment) => paymentMovement(payment, cardNames.get(payment.cardId)));
  return newestFirst([...received, ...paidOut]);
}

/**
 * The purchases and refunds of a card's invoice made up to today, newest first.
 * @example invoiceMovements(transactions, 'credit-card', statement.card.openInvoice, '2026-10-31')
 */
export function invoiceMovements(
  transactions: readonly Transaction[],
  cardId: string,
  invoice: Invoice,
  today: string,
): AccountMovement[] {
  const inInvoice = (date: string): boolean =>
    date >= invoice.startsOn && date < invoice.closesOn && date <= today;
  return newestFirst(
    transactions
      .filter((transaction) => transaction.accountId === cardId && inInvoice(transaction.date))
      .map(transactionMovement),
  );
}

/**
 * What came in and went out across the movements.
 * @example moneyFlows([salary, groceries]) // { inCents: 950000, outCents: 28640 }
 */
export function moneyFlows(movements: readonly AccountMovement[]): MoneyFlows {
  return movements.reduce(
    (flows, movement) =>
      movement.amountCents > 0
        ? { ...flows, inCents: flows.inCents + movement.amountCents }
        : { ...flows, outCents: flows.outCents - movement.amountCents },
    { inCents: 0, outCents: 0 },
  );
}

/**
 * The expenses among the movements, summed by category, the largest first. Income and card payments
 * are left out.
 * @example spendingByCategory([groceries, pharmacy]) // [{ categoryId: 'food', cents: 28640 }, …]
 */
export function spendingByCategory(movements: readonly AccountMovement[]): CategorySpending[] {
  const totals = new Map<string, number>();
  for (const movement of movements) {
    if (movement.categoryId === undefined || movement.amountCents >= 0) continue;
    totals.set(movement.categoryId, (totals.get(movement.categoryId) ?? 0) - movement.amountCents);
  }
  return [...totals]
    .map(([categoryId, cents]) => ({ categoryId, cents }))
    .sort((first, second) => second.cents - first.cents);
}

/**
 * What the bank accounts hold and what the cards owe, over the accounts with a known balance.
 * @example accountTotals(accounts, new Map([['checking-account', 100000]])) // { bankBalanceCents: 100000, cardOwedCents: 0 }
 */
export function accountTotals(
  accounts: readonly Account[],
  balances: ReadonlyMap<string, number>,
): AccountTotals {
  const sumOf = (kind: AccountKind): number =>
    accounts
      .filter((account) => account.kind === kind)
      .reduce((sum, account) => sum + (balances.get(account.id) ?? 0), 0);
  return {
    bankBalanceCents: sumOf('bankAccount'),
    cardOwedCents: Math.max(0, -sumOf('creditCard')),
  };
}

function transactionMovement(transaction: Transaction): AccountMovement {
  return {
    id: transaction.id,
    date: transaction.date,
    description: transaction.description,
    categoryId: transaction.categoryId,
    amountCents: transaction.amountCents,
    isCardPayment: false,
  };
}

function paymentMovement(payment: CardPayment, cardName: string | undefined): AccountMovement {
  return {
    id: payment.id,
    date: payment.date,
    description: cardName === undefined ? 'Card invoice payment' : `Invoice payment · ${cardName}`,
    amountCents: -payment.amountCents,
    isCardPayment: true,
  };
}

// The sort is stable, so movements of the same day keep the order they were given in.
function newestFirst(movements: AccountMovement[]): AccountMovement[] {
  return movements.sort((first, second) => second.date.localeCompare(first.date));
}
