import { AgendaItem, groupAgenda } from './bills';
import { Transaction } from './transaction';
import { shiftMonth } from './transaction-month';
import { summarize } from './transaction-summary';

/** How many months the received-against-spent chart covers, the current one included. */
export const FLOW_MONTHS = 6;
/** How many categories the spending list names before grouping the rest. */
export const TOP_CATEGORIES = 5;
export const LATEST_TRANSACTIONS = 6;
export const UPCOMING_DUES = 5;

/** What came in and what went out in one `YYYY-MM` month, in cents. */
export interface MonthFlow {
  readonly month: string;
  readonly incomeCents: number;
  readonly expenseCents: number;
}

/** What a category took from the month's spending. */
export interface CategorySpending {
  /** Absent on the line that groups the categories beyond the top ones. */
  readonly categoryId?: string;
  readonly name: string;
  readonly cents: number;
  /** Share of the month's spending, 0–100. */
  readonly percent: number;
}

/**
 * The months shown by the chart, oldest first, ending at the given one.
 * @example flowMonths('2026-11')[0] // '2026-06'
 */
export function flowMonths(currentMonth: string): string[] {
  return Array.from({ length: FLOW_MONTHS }, (_, index) =>
    shiftMonth(currentMonth, index - (FLOW_MONTHS - 1)),
  );
}

/**
 * Income and expenses of each month, given the transactions read for each of them in the same order.
 * @example monthlyFlow(['2026-10'], [[salary, groceries]]) // [{ month: '2026-10', incomeCents: 950000, expenseCents: 28640 }]
 */
export function monthlyFlow(
  months: readonly string[],
  transactionsByMonth: readonly (readonly Transaction[])[],
): MonthFlow[] {
  return months.map((month, index) => {
    const { incomeCents, expenseCents } = summarize(transactionsByMonth[index] ?? []);
    return { month, incomeCents, expenseCents };
  });
}

/**
 * The tallest bar of the chart, so each one can be drawn as a share of it; never zero.
 * @example flowPeak([{ month: '2026-10', incomeCents: 500, expenseCents: 800 }]) // 800
 */
export function flowPeak(flow: readonly MonthFlow[]): number {
  return Math.max(1, ...flow.flatMap((month) => [month.incomeCents, month.expenseCents]));
}

/**
 * What the expenses took by category, biggest first: the top categories by name and the rest grouped
 * as "Other categories". Income is ignored.
 * @example spendingByCategory(transactions, new Map([['food', 'Food']]))[0].name // 'Food'
 */
export function spendingByCategory(
  transactions: readonly Transaction[],
  categoryNames: ReadonlyMap<string, string>,
): CategorySpending[] {
  const totals = new Map<string, number>();
  for (const transaction of transactions.filter((current) => current.amountCents < 0)) {
    const spent = totals.get(transaction.categoryId) ?? 0;
    totals.set(transaction.categoryId, spent - transaction.amountCents);
  }
  const ranked = [...totals].sort((first, second) => second[1] - first[1]);
  const all = ranked.reduce((sum, [, cents]) => sum + cents, 0);
  const share = (cents: number): number => (all === 0 ? 0 : Math.round((cents / all) * 100));
  const top = ranked.slice(0, TOP_CATEGORIES).map(([categoryId, cents]) => ({
    categoryId,
    name: categoryNames.get(categoryId) ?? 'Unknown category',
    cents,
    percent: share(cents),
  }));
  const restCents = ranked.slice(TOP_CATEGORIES).reduce((sum, [, cents]) => sum + cents, 0);
  return restCents === 0
    ? top
    : [...top, { name: 'Other categories', cents: restCents, percent: share(restCents) }];
}

/**
 * The most recent transactions, newest day first; within a day the order given is kept.
 * @example latestTransactions(allTransactions, 3).length // 3
 */
export function latestTransactions(
  transactions: readonly Transaction[],
  count: number,
): Transaction[] {
  return transactions
    .map((transaction, position) => ({ transaction, position }))
    .sort(
      (first, second) =>
        second.transaction.date.localeCompare(first.transaction.date) ||
        first.position - second.position,
    )
    .slice(0, count)
    .map((entry) => entry.transaction);
}

/**
 * The next things to pay or receive, overdue first and then by due date.
 * @example upcomingDues(items, '2026-11-03', 5).map((item) => item.key)
 */
export function upcomingDues(
  items: readonly AgendaItem[],
  today: string,
  count: number,
): AgendaItem[] {
  const groups = groupAgenda(items, today);
  return [...groups.overdue, ...groups.soon, ...groups.later].slice(0, count);
}
