import { isoDate, parseIsoDate } from '../calendar/date-label';

/*
 * Months are carried as `YYYY-MM` text, the shape the API reads them in; every helper here keeps
 * to the local calendar.
 */

/**
 * The month a moment falls in.
 * @example monthOf(new Date(2026, 9, 31, 23, 50)) // '2026-10'
 */
export function monthOf(moment: Date): string {
  return isoDate(moment).slice(0, 7);
}

/**
 * The month of an ISO day.
 * @example monthOfDay('2026-10-31') // '2026-10'
 */
export function monthOfDay(isoDay: string): string {
  return isoDay.slice(0, 7);
}

/**
 * The month `step` months away (negative goes back).
 * @example shiftMonth('2026-12', 1) // '2027-01'
 */
export function shiftMonth(month: string, step: number): string {
  const first = parseIsoDate(`${month}-01`);
  return monthOf(new Date(first.getFullYear(), first.getMonth() + step, 1));
}

/**
 * The month spelled out with its year.
 * @example monthLabel('2026-10', 'en-US') // 'October 2026'
 */
export function monthLabel(month: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    parseIsoDate(`${month}-01`),
  );
}

/**
 * The day a new transaction starts on: today when the month shown is the current one, otherwise
 * the month's first day, so it lands in the month the user is looking at.
 * @example defaultDayIn('2026-09', '2026-10-31') // '2026-09-01'
 */
export function defaultDayIn(month: string, today: string): string {
  return monthOfDay(today) === month ? today : `${month}-01`;
}
