const MINUTES_PER_HOUR = 60;
const LAST_MINUTE_OF_DAY = 24 * MINUTES_PER_HOUR - 1;
const CLOCK_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Minutes since midnight for an `HH:MM` clock time.
 * @example toMinutes('13:30') // 810
 */
export function toMinutes(clock: string): number {
  const match = CLOCK_PATTERN.exec(clock);
  if (match === null) {
    throw new RangeError(`Expected a clock time shaped like HH:MM, received "${clock}"`);
  }
  return Number(match[1]) * MINUTES_PER_HOUR + Number(match[2]);
}

/**
 * `HH:MM` clock time for minutes since midnight, clamped to the same day.
 * @example formatClock(810) // '13:30'
 */
export function formatClock(minutes: number): string {
  const clamped = Math.max(0, Math.min(LAST_MINUTE_OF_DAY, Math.round(minutes)));
  const hours = Math.floor(clamped / MINUTES_PER_HOUR);
  return `${pad(hours)}:${pad(clamped % MINUTES_PER_HOUR)}`;
}

/**
 * Compact duration such as `7h30` or `2h`.
 * @example formatDuration(450) // '7h30'
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;
  return rest === 0 ? `${hours}h` : `${hours}h${pad(rest)}`;
}

/**
 * Minutes since midnight of a moment.
 * @example minutesOfDay(new Date(2026, 9, 26, 14, 10)) // 850
 */
export function minutesOfDay(moment: Date): number {
  return moment.getHours() * MINUTES_PER_HOUR + moment.getMinutes();
}

/**
 * Weekday index where Monday is 0 and Sunday is 6.
 * @example weekdayIndex(new Date(2026, 9, 26)) // 0
 */
export function weekdayIndex(moment: Date): number {
  return (moment.getDay() + 6) % 7;
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}
