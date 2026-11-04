import { Transaction } from './transaction';
import { sum } from './transaction-summary';

/** The transactions of one day and what they add up to. */
export interface TransactionDay {
  /** `YYYY-MM-DD`. */
  readonly date: string;
  readonly totalCents: number;
  readonly transactions: readonly Transaction[];
}

/**
 * Groups transactions by day, newest day first; within a day they keep the order they came in
 * (the store keeps the most recently added first).
 * @example groupByDay([oct31Groceries, oct30Streaming, oct31Fuel]).map((day) => day.date) // ['2026-10-31', '2026-10-30']
 */
export function groupByDay(transactions: readonly Transaction[]): TransactionDay[] {
  const byDate = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    const day = byDate.get(transaction.date) ?? [];
    day.push(transaction);
    byDate.set(transaction.date, day);
  }
  return [...byDate.entries()]
    .sort(([first], [second]) => second.localeCompare(first))
    .map(([date, items]) => ({
      date,
      totalCents: sum(items.map((item) => item.amountCents)),
      transactions: items,
    }));
}
