import { formatDate } from '@angular/common';

/**
 * Weekday, month and day used as the eyebrow of daily pages.
 * @example longDateLabel(new Date(2026, 9, 26), 'en-US') // 'Monday, October 26'
 */
export function longDateLabel(date: Date, locale: string): string {
  return formatDate(date, 'EEEE, MMMM d', locale);
}

/**
 * The local calendar day of a moment as an ISO date, the shape the API exchanges days in.
 * @example isoDate(new Date(2026, 9, 26, 23, 30)) // '2026-10-26'
 */
export function isoDate(date: Date): string {
  return formatDate(date, 'yyyy-MM-dd', 'en-US');
}
