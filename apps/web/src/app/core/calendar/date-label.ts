import { formatDate } from '@angular/common';

/**
 * Weekday, month and day used as the eyebrow of daily pages.
 * @example longDateLabel(new Date(2026, 9, 26), 'en-US') // 'Monday, October 26'
 */
export function longDateLabel(date: Date, locale: string): string {
  return formatDate(date, 'EEEE, MMMM d', locale);
}

/**
 * Month and day of an ISO day, short enough for a list row or a stat.
 * @example shortDateLabel('2026-11-03', 'en-US') // 'Nov 3'
 */
export function shortDateLabel(isoDay: string, locale: string): string {
  return formatDate(parseIsoDate(isoDay), 'MMM d', locale);
}

/**
 * The local calendar day of a moment as an ISO date, the shape the API exchanges days in.
 * @example isoDate(new Date(2026, 9, 26, 23, 30)) // '2026-10-26'
 */
export function isoDate(date: Date): string {
  return formatDate(date, 'yyyy-MM-dd', 'en-US');
}

/**
 * Local date for an ISO `YYYY-MM-DD` string (avoids the UTC shift of `new Date(iso)`).
 * @example parseIsoDate('2026-12-15').getDate() // 15
 */
export function parseIsoDate(isoDay: string): Date {
  const [year, month, day] = isoDay.split('-').map(Number);
  return new Date(year, month - 1, day);
}
