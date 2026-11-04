/** How many months a preset period looks back. */
export type PeriodMonths = 3 | 6 | 12;

export const PERIOD_OPTIONS: readonly PeriodMonths[] = [3, 6, 12];

/** The stretch of time a page covers: the last months, or days the person picked. */
export type Period =
  | { readonly kind: 'months'; readonly months: PeriodMonths }
  | { readonly kind: 'custom'; readonly from: string; readonly to: string };

/** First and last day (both included) of a stretch of time, as `YYYY-MM-DD`. */
export interface DayRange {
  readonly from: string;
  readonly to: string;
}

/** The longest custom period, in months, so a chart stays readable. */
export const MAX_CUSTOM_MONTHS = 120;

const MONTHS_PER_YEAR = 12;

/**
 * The `count` months ending at the month of `today`, oldest first, as `YYYY-MM`.
 * @example monthKeys('2026-02-10', 3) // ['2025-12', '2026-01', '2026-02']
 */
export function monthKeys(today: string, count: number): string[] {
  const lastIndex = Number(today.slice(0, 4)) * MONTHS_PER_YEAR + Number(today.slice(5, 7)) - 1;
  return Array.from({ length: count }, (_, position) => {
    const index = lastIndex - (count - 1 - position);
    const month = (index % MONTHS_PER_YEAR) + 1;
    return `${Math.floor(index / MONTHS_PER_YEAR)}-${String(month).padStart(2, '0')}`;
  });
}

/**
 * The days a period covers: a preset goes from the first day of its oldest month to today.
 * @example periodRange({ kind: 'months', months: 3 }, '2026-11-03') // { from: '2026-09-01', to: '2026-11-03' }
 */
export function periodRange(period: Period, today: string): DayRange {
  if (period.kind === 'custom') return { from: period.from, to: period.to };
  return { from: `${monthKeys(today, period.months)[0]}-01`, to: today };
}

/**
 * The `YYYY-MM` months a period touches, oldest first.
 * @example periodMonths({ kind: 'custom', from: '2026-08-15', to: '2026-10-02' }, '2026-11-03') // ['2026-08', '2026-09', '2026-10']
 */
export function periodMonths(period: Period, today: string): string[] {
  const { from, to } = periodRange(period, today);
  return monthsBetween(from.slice(0, 7), to.slice(0, 7));
}

/**
 * Every `YYYY-MM` month from one to the other, both included.
 * @example monthsBetween('2025-11', '2026-01') // ['2025-11', '2025-12', '2026-01']
 */
export function monthsBetween(firstMonth: string, lastMonth: string): string[] {
  const count = monthIndex(lastMonth) - monthIndex(firstMonth) + 1;
  return count < 1 ? [] : monthKeys(`${lastMonth}-01`, count);
}

/**
 * Whether two typed days make a period that can be shown: real days, the start not after the end, and no
 * more than `MAX_CUSTOM_MONTHS` months.
 * @example isValidCustomPeriod('2026-01-01', '2026-03-31') // true
 */
export function isValidCustomPeriod(from: string, to: string): boolean {
  // A real calendar day: February 30 would otherwise slide into March.
  const isDay = (text: string): boolean => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (match === null) return false;
    const day = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return day.getMonth() === Number(match[2]) - 1 && day.getDate() === Number(match[3]);
  };
  if (!isDay(from) || !isDay(to) || from > to) return false;
  return monthsBetween(from.slice(0, 7), to.slice(0, 7)).length <= MAX_CUSTOM_MONTHS;
}

function monthIndex(month: string): number {
  return Number(month.slice(0, 4)) * MONTHS_PER_YEAR + Number(month.slice(5, 7)) - 1;
}
