import { Transaction } from './transaction';

/** Totals of a list of transactions, in cents. */
export interface TransactionSummary {
  readonly incomeCents: number;
  /** Money that went out, as a positive number. */
  readonly expenseCents: number;
  /** Income minus expenses; negative when more went out than came in. */
  readonly netCents: number;
  readonly count: number;
}

/**
 * Adds up what came in and what went out.
 * @example summarize([salary, groceries]).netCents // 950000 - 28640
 */
export function summarize(transactions: readonly Transaction[]): TransactionSummary {
  const amounts = transactions.map((transaction) => transaction.amountCents);
  const incomeCents = sum(amounts.filter((amount) => amount > 0));
  // Negated item by item: negating the sum of no expenses would give -0.
  const expenseCents = sum(amounts.filter((amount) => amount < 0).map((amount) => -amount));
  return {
    incomeCents,
    expenseCents,
    netCents: incomeCents - expenseCents,
    count: transactions.length,
  };
}

/**
 * Adds up amounts in cents.
 * @example sum([100, -40]) // 60
 */
export function sum(amounts: readonly number[]): number {
  return amounts.reduce((total, amount) => total + amount, 0);
}
