import { formatDate } from '@angular/common';

/**
 * Weekday, month and day used as the eyebrow of daily pages.
 * @example longDateLabel(new Date(2026, 9, 26), 'en-US') // 'Monday, October 26'
 */
export function longDateLabel(date: Date, locale: string): string {
  return formatDate(date, 'EEEE, MMMM d', locale);
}
