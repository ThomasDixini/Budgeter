import { appliedByMonth } from './investments-analytics';
import { MonthlyPoint, Portfolio } from './investments';
import { monthKeys } from './period';

const MONTHS_SHOWN = 36;
/** Monthly CDI used for the made-up comparison line, about 12.6% a year. */
const MONTHLY_CDI = 0.01;
const PERCENT = 100;

/**
 * FICTITIOUS month-end history for the portfolio, so the charts that need it can be seen filled in while
 * the API keeps no price history. The value drifts above what was applied with a deterministic wiggle (the
 * same numbers on every load). None of it is real data, apart from what was applied: replace
 * this by the history the API sends once it keeps month-end prices, and delete this file.
 * @example placeholderHistory(portfolio, '2026-11-04')[0].month // '2023-12'
 */
export function placeholderHistory(portfolio: Portfolio, today: string): MonthlyPoint[] {
  const ids = new Set(portfolio.lines.map((line) => line.investment.id));
  const months = monthKeys(today, MONTHS_SHOWN);
  const applied = appliedByMonth(portfolio.trades, ids, months);
  const first = applied.findIndex((cents) => cents > 0);
  if (first < 0) return [];
  return months.slice(first).map((month, step) => {
    const appliedCents = applied[first + step];
    const valueCents = driftedValue(appliedCents, step);
    return {
      month,
      appliedCents,
      valueCents,
      returnPercent:
        appliedCents === 0 ? 0 : ((valueCents - appliedCents) / appliedCents) * PERCENT,
      cdiPercent: ((1 + MONTHLY_CDI) ** (step + 1) - 1) * PERCENT,
    };
  });
}

/** The applied money grown by a slow climb with some ups and downs, the same for the same month. */
function driftedValue(appliedCents: number, step: number): number {
  const climb = 0.009 * step;
  const wiggle = 0.03 * Math.sin(step * 1.7) + 0.015 * Math.sin(step * 0.6 + 1);
  return Math.round(appliedCents * (1 + climb + wiggle));
}
