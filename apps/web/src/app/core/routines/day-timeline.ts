import { formatClock, toMinutes } from '../calendar/time-of-day';
import { Routine, RoutineBlock, blockMinutesWithin, routineSpan, sortBlocks } from './routine';

/** Vertical pixels per hour on the Today timeline. */
export const TIMELINE_HOUR_HEIGHT = 48;
const MINUTES_PER_HOUR = 60;

export interface TimelineHour {
  readonly label: string;
  readonly top: number;
}

export interface TimelineBlock {
  readonly block: RoutineBlock;
  readonly top: number;
  readonly height: number;
  readonly isNow: boolean;
}

/**
 * Total height of the timeline for a routine.
 * @example timelineHeight({ start: '08:00', end: '17:00' }) // 432
 */
export function timelineHeight(routine: Pick<Routine, 'start' | 'end'>): number {
  return toPixels(routineSpan(routine));
}

/**
 * One gridline per whole hour of the routine day.
 * @example timelineHours({ start: '08:00', end: '09:00' }) // [{ label: '08:00', top: 0 }, { label: '09:00', top: 48 }]
 */
export function timelineHours(routine: Pick<Routine, 'start' | 'end'>): TimelineHour[] {
  const start = toMinutes(routine.start);
  const hours: TimelineHour[] = [];
  for (let minute = Math.ceil(start / 60) * 60; minute <= toMinutes(routine.end); minute += 60) {
    hours.push({ label: formatClock(minute), top: toPixels(minute - start) });
  }
  return hours;
}

/**
 * Blocks placed on the timeline, flagging the one happening now.
 * @example timelineBlocks(weekdays, 850).find((item) => item.isNow)?.block.name // 'C# study'
 */
export function timelineBlocks(routine: Routine, nowMinutes: number): TimelineBlock[] {
  const start = toMinutes(routine.start);
  return sortBlocks(routine.blocks)
    .filter((block) => blockMinutesWithin(block, routine) > 0)
    .map((block) => ({
      block,
      top: toPixels(Math.max(toMinutes(block.start), start) - start),
      height: toPixels(blockMinutesWithin(block, routine)),
      isNow: isHappening(block, nowMinutes),
    }));
}

/**
 * Pixel offset of the "now" line, or undefined outside the routine day.
 * @example nowLineOffset(weekdays, 850) // 296
 */
export function nowLineOffset(routine: Routine, nowMinutes: number): number | undefined {
  const start = toMinutes(routine.start);
  if (nowMinutes < start || nowMinutes > toMinutes(routine.end)) return undefined;
  return toPixels(nowMinutes - start);
}

/**
 * How much of the routine day has passed, 0 to 100.
 * @example dayProgress(weekdays, 850) // 69
 */
export function dayProgress(routine: Routine, nowMinutes: number): number {
  const elapsed = nowMinutes - toMinutes(routine.start);
  return Math.round(Math.max(0, Math.min(1, elapsed / routineSpan(routine))) * 100);
}

/**
 * The block running at a given minute, if any.
 * @example currentBlock(weekdays, 850)?.name // 'C# study'
 */
export function currentBlock(routine: Routine, nowMinutes: number): RoutineBlock | undefined {
  return routine.blocks.find((block) => isHappening(block, nowMinutes));
}

/**
 * Elapsed share of a block, 0 to 100.
 * @example blockElapsed({ start: '13:30', end: '15:00' }, 850) // 44
 */
export function blockElapsed(
  block: Pick<RoutineBlock, 'start' | 'end'>,
  nowMinutes: number,
): number {
  const length = Math.max(1, toMinutes(block.end) - toMinutes(block.start));
  const elapsed = nowMinutes - toMinutes(block.start);
  return Math.round(Math.max(0, Math.min(1, elapsed / length)) * 100);
}

/**
 * Minutes until a block ends, never negative.
 * @example minutesLeft({ end: '15:00' }, 850) // 50
 */
export function minutesLeft(block: Pick<RoutineBlock, 'end'>, nowMinutes: number): number {
  return Math.max(0, toMinutes(block.end) - nowMinutes);
}

function isHappening(block: Pick<RoutineBlock, 'start' | 'end'>, nowMinutes: number): boolean {
  return nowMinutes >= toMinutes(block.start) && nowMinutes < toMinutes(block.end);
}

function toPixels(minutes: number): number {
  return Math.round((minutes / MINUTES_PER_HOUR) * TIMELINE_HOUR_HEIGHT);
}
