import { Income, InvestmentKind, PortfolioLine, Trade, tradeTotalCents } from './investments';

import { DayRange, Period } from './period';

/** What the page narrows the portfolio to; an absent field means everything. */
export interface InvestmentFilters {
  readonly kind?: InvestmentKind;
  readonly investmentId?: string;
  readonly period: Period;
}

/** One class of investment and its share of the portfolio. */
export interface DistributionSlice {
  readonly kind: InvestmentKind;
  readonly valueCents: number;
  readonly percent: number;
}

/**
 * What a line is worth: its value, or what it cost while no price is known.
 * @example lineValueCents({ ...line, valueCents: undefined, costCents: 5000 }) // 5000
 */
export function lineValueCents(line: Pick<PortfolioLine, 'valueCents' | 'costCents'>): number {
  return line.valueCents ?? line.costCents;
}

/**
 * The lines of one kind and/or one investment; all of them when neither is given.
 * @example filterLines(lines, { kind: 'stock' }).length
 */
export function filterLines(
  lines: readonly PortfolioLine[],
  filters: Pick<InvestmentFilters, 'kind' | 'investmentId'>,
): PortfolioLine[] {
  return lines.filter(
    (line) =>
      (filters.kind === undefined || line.investment.kind === filters.kind) &&
      (filters.investmentId === undefined || line.investment.id === filters.investmentId),
  );
}

/**
 * Proventos received in each month, for the given investments; with a `range`, only the ones received
 * on its days count.
 * @example incomeByMonth(incomes, new Set(['petr4']), ['2026-10', '2026-11']) // [1500, 0]
 */
export function incomeByMonth(
  incomes: readonly Income[],
  investmentIds: ReadonlySet<string>,
  months: readonly string[],
  range?: DayRange,
): number[] {
  const mine = incomes.filter(
    (income) =>
      investmentIds.has(income.investmentId) &&
      (range === undefined || (income.date >= range.from && income.date <= range.to)),
  );
  return months.map((month) =>
    mine
      .filter((income) => income.date.slice(0, 7) === month)
      .reduce((total, income) => total + income.amountCents, 0),
  );
}

/**
 * What had been put in (purchases minus sales, at what they came to) by the end of each month.
 * @example appliedByMonth(trades, new Set(['petr4']), ['2026-10', '2026-11']) // [100000, 100000]
 */
export function appliedByMonth(
  trades: readonly Trade[],
  investmentIds: ReadonlySet<string>,
  months: readonly string[],
): number[] {
  const mine = trades.filter((trade) => investmentIds.has(trade.investmentId));
  return months.map((month) =>
    mine
      .filter((trade) => trade.date.slice(0, 7) <= month)
      .reduce((total, trade) => total + signedTradeCents(trade), 0),
  );
}

/**
 * How the portfolio splits between kinds of investment, biggest first; empty when it is worth nothing.
 * @example distribution(lines)[0] // { kind: 'fixedIncome', valueCents: 3491300, percent: 47 }
 */
export function distribution(lines: readonly PortfolioLine[]): DistributionSlice[] {
  const total = lines.reduce((sum, line) => sum + lineValueCents(line), 0);
  if (total <= 0) return [];
  const byKind = new Map<InvestmentKind, number>();
  for (const line of lines) {
    const kind = line.investment.kind;
    byKind.set(kind, (byKind.get(kind) ?? 0) + lineValueCents(line));
  }
  return [...byKind]
    .map(([kind, valueCents]) => ({ kind, valueCents, percent: (valueCents / total) * 100 }))
    .sort((first, second) => second.valueCents - first.valueCents);
}

function signedTradeCents(trade: Trade): number {
  const total = tradeTotalCents(trade.quantityThousandths, trade.unitPriceCents);
  return trade.kind === 'buy' ? total : -total;
}
