import { toMinutes } from '../calendar/time-of-day';
import { blockLength, blockMinutesWithin, dayPieces, hourMarks, routineSpan } from './day-clock';

export { blockMinutesWithin, routineSpan } from './day-clock';

/** A slice of the day, optionally tied to a category so it counts toward its goals. */
export interface RoutineBlock {
  readonly id: string;
  readonly name: string;
  readonly start: string;
  /** At or before `start` when the block runs past midnight. */
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
  /** Equal to `start` for a full 24-hour day; before it when the day runs past midnight. */
  readonly end: string;
  readonly blocks: readonly RoutineBlock[];
}

const DAYS_PER_WEEK = 7;

export const WEEKDAY_LABELS: readonly string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Blocks ordered by start time.
 * @example sortBlocks(routine.blocks)[0].name // 'Work'
 */
export function sortBlocks(blocks: readonly RoutineBlock[]): RoutineBlock[] {
  return [...blocks].sort((first, second) => toMinutes(first.start) - toMinutes(second.start));
}

/**
 * Human messages for blocks that take no time. An end before the start is not an issue (the
 * block runs past midnight), and neither is an overlap (a podcast can run during work).
 * @example scheduleIssues([{ ...lunch, end: lunch.start }]) // ['"Lunch" starts and ends at the same time']
 */
export function scheduleIssues(blocks: readonly RoutineBlock[]): string[] {
  return sortBlocks(blocks)
    .filter((block) => blockLength(block) === 0)
    .map((block) => `"${block.name}" starts and ends at the same time`);
}

/**
 * Minutes per day covered by at least one block; overlapping time counts once.
 * @example plannedMinutes(routine) // 540
 */
export function plannedMinutes(routine: Routine): number {
  let covered = 0;
  let coveredUntil = 0;
  for (const piece of dayPieces(routine)) {
    const start = Math.max(piece.start, coveredUntil);
    if (piece.end <= start) continue;
    covered += piece.end - start;
    coveredUntil = piece.end;
  }
  return covered;
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

/** Hour labels the horizontal bar fits without overlapping; longer days label every few hours. */
const MAX_HOUR_TICKS = 10;

/**
 * Tick labels with their position along the day, in percent: hourly for a working day,
 * every few hours for a long one (every 3h across 24 hours).
 * @example hourTicks({ start: '08:00', end: '10:00' })[1] // { label: '09:00', offset: 50 }
 */
export function hourTicks(
  routine: Pick<Routine, 'start' | 'end'>,
): { readonly label: string; readonly offset: number }[] {
  const span = routineSpan(routine);
  const stepHours = Math.max(1, Math.ceil(span / 60 / (MAX_HOUR_TICKS - 1)));
  return hourMarks(routine, stepHours).map(({ label, offset }) => ({
    label,
    offset: (offset / span) * 100,
  }));
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

/** The routine running at a moment, and whether it began the evening before. */
export interface ActiveRoutine {
  readonly routine: Routine;
  readonly startedYesterday: boolean;
}

/**
 * The routine running at a moment. Before the end of a routine that began yesterday and runs past
 * midnight (a night shift), that one is still running; otherwise it is the one of today's weekday.
 * @example activeRoutine(routines, 1, 120)?.routine.name // 'Night shift' (Tuesday 02:00, started Monday)
 */
export function activeRoutine(
  routines: readonly Routine[],
  weekday: number,
  nowMinutes: number,
): ActiveRoutine | undefined {
  const carriedOver = routineForWeekday(routines, (weekday + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK);
  if (carriedOver !== undefined && runsPastMidnight(carriedOver, nowMinutes)) {
    return { routine: carriedOver, startedYesterday: true };
  }
  const today = routineForWeekday(routines, weekday);
  return today === undefined ? undefined : { routine: today, startedYesterday: false };
}

function runsPastMidnight(routine: Routine, nowMinutes: number): boolean {
  const end = toMinutes(routine.end);
  return end <= toMinutes(routine.start) && nowMinutes < end;
}
