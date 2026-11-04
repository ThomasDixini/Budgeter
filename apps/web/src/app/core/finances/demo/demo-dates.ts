import { isoDate, parseIsoDate } from '../../calendar/date-label';

const MONTHS_PER_YEAR = 12;
const MS_PER_DAY = 86_400_000;

/**
 * The day `days` after (or before, when negative) an ISO day.
 * @example addDays('2026-11-03', -3) // '2026-10-31'
 */
export function addDays(day: string, days: number): string {
  const date = parseIsoDate(day);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

/**
 * The `YYYY-MM` month `months` after (or before) the month of an ISO day.
 * @example addMonths('2026-01-15', -2) // '2025-11'
 */
export function addMonths(day: string, months: number): string {
  const index = Number(day.slice(0, 4)) * MONTHS_PER_YEAR + Number(day.slice(5, 7)) - 1 + months;
  const month = (index % MONTHS_PER_YEAR) + 1;
  return `${Math.floor(index / MONTHS_PER_YEAR)}-${String(month).padStart(2, '0')}`;
}

/**
 * The given day of a `YYYY-MM` month, or its last day when the month is shorter.
 * @example dayOfMonth('2026-02', 31) // '2026-02-28'
 */
export function dayOfMonth(month: string, day: number): string {
  const last = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  return `${month}-${String(Math.min(day, last)).padStart(2, '0')}`;
}

/**
 * The last day of a `YYYY-MM` month.
 * @example monthEnd('2026-02') // '2026-02-28'
 */
export function monthEnd(month: string): string {
  return dayOfMonth(month, 31);
}

/**
 * Whole days between two ISO days (negative when the second is earlier).
 * @example daysBetweenDays('2026-11-01', '2026-11-04') // 3
 */
export function daysBetweenDays(from: string, to: string): number {
  return Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / MS_PER_DAY);
}
