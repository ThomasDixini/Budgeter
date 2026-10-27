import { formatClock, toMinutes } from '../calendar/time-of-day';

/** A slice of the day, optionally tied to a category so it counts toward its goals. */
export interface RoutineBlock {
  readonly id: string;
  readonly name: string;
  readonly start: string;
  readonly end: string;
  readonly categoryId?: string;
}

/** A day template (e.g. weekdays) with its hours and blocks. */
export interface Routine {
  readonly id: string;
  readonly name: string;
  /** Weekday indexes, Monday = 0. */
  readonly days: readonly number[];
  readonly start: string;
  readonly end: string;
  readonly blocks: readonly RoutineBlock[];
}

export const WEEKDAY_LABELS: readonly string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Length of the routine day in minutes; never zero so it can divide.
 * @example routineSpan({ start: '08:00', end: '17:00' }) // 540
 */
export function routineSpan(routine: Pick<Routine, 'start' | 'end'>): number {
  return Math.max(1, toMinutes(routine.end) - toMinutes(routine.start));
}

/**
 * Minutes of a block that fall inside the routine day.
 * @example blockMinutesWithin(block, routine) // 90
 */
export function blockMinutesWithin(
  block: Pick<RoutineBlock, 'start' | 'end'>,
  routine: Pick<Routine, 'start' | 'end'>,
): number {
  const start = Math.max(toMinutes(block.start), toMinutes(routine.start));
  const end = Math.min(toMinutes(block.end), toMinutes(routine.end));
  return Math.max(0, end - start);
}

/**
 * Blocks ordered by start time.
 * @example sortBlocks(routine.blocks)[0].name // 'Work'
 */
export function sortBlocks(blocks: readonly RoutineBlock[]): RoutineBlock[] {
  return [...blocks].sort((first, second) => toMinutes(first.start) - toMinutes(second.start));
}

/**
 * Human messages for blocks that end before they start or overlap the previous one.
 * @example scheduleIssues([lunchEndingEarly]) // ['"Lunch" ends before it starts']
 */
export function scheduleIssues(blocks: readonly RoutineBlock[]): string[] {
  const sorted = sortBlocks(blocks);
  return sorted.flatMap((block, index) => {
    const issues: string[] = [];
    if (toMinutes(block.end) <= toMinutes(block.start)) {
      issues.push(`"${block.name}" ends before it starts`);
    }
    const previous = sorted[index - 1];
    if (previous !== undefined && toMinutes(block.start) < toMinutes(previous.end)) {
      issues.push(`"${previous.name}" and "${block.name}" overlap`);
    }
    return issues;
  });
}

/**
 * Minutes per day covered by blocks.
 * @example plannedMinutes(routine) // 540
 */
export function plannedMinutes(routine: Routine): number {
  return routine.blocks.reduce((sum, block) => sum + blockMinutesWithin(block, routine), 0);
}

/**
 * Minutes per week each category gets in this routine; blocks without a category are skipped.
 * @example weeklyMinutesByCategory(weekdays).get('study') // 450
 */
export function weeklyMinutesByCategory(routine: Routine): Map<string, number> {
  const totals = new Map<string, number>();
  for (const block of routine.blocks) {
    if (block.categoryId === undefined) continue;
    const weekly = blockMinutesWithin(block, routine) * routine.days.length;
    totals.set(block.categoryId, (totals.get(block.categoryId) ?? 0) + weekly);
  }
  return totals;
}

/**
 * Hourly tick labels with their position along the day, in percent.
 * @example hourTicks({ start: '08:00', end: '10:00' })[1] // { label: '09:00', offset: 50 }
 */
export function hourTicks(
  routine: Pick<Routine, 'start' | 'end'>,
): { readonly label: string; readonly offset: number }[] {
  const start = toMinutes(routine.start);
  const end = toMinutes(routine.end);
  const ticks: { label: string; offset: number }[] = [];
  for (let minute = Math.ceil(start / 60) * 60; minute <= end; minute += 60) {
    ticks.push({
      label: formatClock(minute),
      offset: ((minute - start) / routineSpan(routine)) * 100,
    });
  }
  return ticks;
}

/**
 * Compact label for a set of weekdays: a range when contiguous, a list otherwise.
 * @example weekdaysLabel([0, 1, 2, 3, 4]) // 'Mon–Fri'
 */
export function weekdaysLabel(days: readonly number[]): string {
  const sorted = [...days].sort((first, second) => first - second);
  if (sorted.length === 0) return 'No days';
  const isContiguous = sorted.every((day, index) => index === 0 || day === sorted[index - 1] + 1);
  if (isContiguous && sorted.length > 1) {
    return `${WEEKDAY_LABELS[sorted[0]]}–${WEEKDAY_LABELS[sorted[sorted.length - 1]]}`;
  }
  return sorted.map((day) => WEEKDAY_LABELS[day]).join(', ');
}

/**
 * The routine that applies on a weekday, if any.
 * @example routineForWeekday(routines, 5)?.name // 'Weekend'
 */
export function routineForWeekday(
  routines: readonly Routine[],
  weekday: number,
): Routine | undefined {
  return routines.find((routine) => routine.days.includes(weekday));
}
