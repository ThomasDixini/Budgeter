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
 * Human messages for blocks that end before they start. Overlaps are not issues: a block can
 * run alongside another on purpose (a podcast during work), so views lay them out in lanes.
 * @example scheduleIssues([lunchEndingEarly]) // ['"Lunch" ends before it starts']
 */
export function scheduleIssues(blocks: readonly RoutineBlock[]): string[] {
  return sortBlocks(blocks)
    .filter((block) => toMinutes(block.end) <= toMinutes(block.start))
    .map((block) => `"${block.name}" ends before it starts`);
}

/**
 * Minutes per day covered by at least one block; overlapping time counts once.
 * @example plannedMinutes(routine) // 540
 */
export function plannedMinutes(routine: Routine): number {
  let covered = 0;
  let coveredUntil = toMinutes(routine.start);
  for (const block of sortBlocks(routine.blocks)) {
    const start = Math.max(toMinutes(block.start), coveredUntil);
    const end = Math.min(toMinutes(block.end), toMinutes(routine.end));
    if (end <= start) continue;
    covered += end - start;
    coveredUntil = end;
  }
  return covered;
}

/**
 * Blocks with time inside the routine day, by start.
 * @example visibleBlocks(shortDay).map((block) => block.id) // ['work']
 */
export function visibleBlocks(routine: Routine): RoutineBlock[] {
  return sortBlocks(routine.blocks).filter((block) => blockMinutesWithin(block, routine) > 0);
}

/** Where a block sits among the blocks it overlaps: lane `lane` (0-based) of `lanes`. */
export interface LanePlacement {
  readonly lane: number;
  readonly lanes: number;
}

/** Placement of a block that overlaps nothing. */
export const SINGLE_LANE: LanePlacement = { lane: 0, lanes: 1 };

/**
 * Spreads overlapping blocks over side-by-side lanes. Blocks that overlap nothing get the whole
 * width (one lane); each group of overlapping blocks shares as many lanes as it needs.
 * @example blockLanes([work, podcast]).get('podcast') // { lane: 1, lanes: 2 }
 */
export function blockLanes(blocks: readonly RoutineBlock[]): Map<string, LanePlacement> {
  const placements = new Map<string, LanePlacement>();
  for (const group of overlapGroups(sortBlocks(blocks))) {
    const lanes = laneIndexes(group);
    const laneCount = Math.max(...lanes.values()) + 1;
    for (const [blockId, lane] of lanes) placements.set(blockId, { lane, lanes: laneCount });
  }
  return placements;
}

/**
 * Most lanes any group of overlapping blocks needs, at least one.
 * @example maxLanes([work, podcast, lunch]) // 2
 */
export function maxLanes(blocks: readonly RoutineBlock[]): number {
  return Math.max(1, ...[...blockLanes(blocks).values()].map((placement) => placement.lanes));
}

/** Splits blocks sorted by start into runs where each block overlaps the run before it. */
function overlapGroups(sorted: readonly RoutineBlock[]): RoutineBlock[][] {
  const groups: RoutineBlock[][] = [];
  let groupEnd = -1;
  for (const block of sorted) {
    if (groups.length === 0 || toMinutes(block.start) >= groupEnd) groups.push([]);
    groups[groups.length - 1].push(block);
    groupEnd = Math.max(groupEnd, endMinutes(block));
  }
  return groups;
}

/** Puts each block in the first lane free at its start, opening a lane when none is. */
function laneIndexes(group: readonly RoutineBlock[]): Map<string, number> {
  const laneEnds: number[] = [];
  const lanes = new Map<string, number>();
  for (const block of group) {
    const free = laneEnds.findIndex((laneEnd) => laneEnd <= toMinutes(block.start));
    const lane = free === -1 ? laneEnds.length : free;
    laneEnds[lane] = endMinutes(block);
    lanes.set(block.id, lane);
  }
  return lanes;
}

/** A block that ends before it starts takes no time, so it never pushes others aside. */
function endMinutes(block: Pick<RoutineBlock, 'start' | 'end'>): number {
  return Math.max(toMinutes(block.start), toMinutes(block.end));
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
