import { toMinutes } from '../calendar/time-of-day';
import {
  DayPiece,
  blockLength,
  clockDistance,
  dayPieces,
  hourMarks,
  isHappening,
  offsetInDay,
  routineSpan,
} from './day-clock';
import { Routine, RoutineBlock } from './routine';

/** Vertical pixels per hour on the Today timeline. */
export const TIMELINE_HOUR_HEIGHT = 48;
/**
 * Below this height a block cannot fit its name and time on two lines with padding, so it is
 * drawn on one compact line (about 80 minutes at 48px per hour).
 */
const COMPACT_BLOCK_MAX_HEIGHT = 64;
/** Shortest time an ended block is drawn with, so one finished in a minute still shows (24px). */
const MIN_ENDED_BLOCK_MINUTES = 30;

/**
 * Whether a timeline block is too short for the two-line layout.
 * @example isCompactBlock(24) // true (a 30-minute block)
 */
export function isCompactBlock(heightPixels: number): boolean {
  return heightPixels < COMPACT_BLOCK_MAX_HEIGHT;
}
const MINUTES_PER_HOUR = 60;

export interface TimelineHour {
  readonly label: string;
  readonly top: number;
}

/**
 * A block (or one piece of a block wrapping around a 24-hour day) on the Today timeline, as a
 * full-width row: `top`/`height` in pixels.
 */
export interface TimelineBlock {
  readonly block: RoutineBlock;
  /** Unique per entry; a wrapping block yields two. */
  readonly key: string;
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
  return hourMarks(routine).map(({ label, offset }) => ({ label, top: toPixels(offset) }));
}

/**
 * Blocks placed on the timeline, each on its own full-width row, flagging the ones happening now.
 * Blocks completed or skipped today are keys of `endedBlocks`, mapped to their planned length:
 * - while the day is running they stack upward from the "now" line, each at least one line tall,
 *   so none reaches past the line and none hides another;
 * - outside the day (no "now" line) they are drawn at their planned length, stacked downward.
 * @example timelineBlocks(weekdays, 850).find((item) => item.isNow)?.block.name // 'C# study'
 */
export function timelineBlocks(
  routine: Routine,
  nowMinutes: number,
  endedBlocks: ReadonlyMap<string, number> = new Map(),
): TimelineBlock[] {
  const nowOffset = offsetInDay(nowMinutes, routine);
  // In the order they were ended, which breaks ties when several end at the same minute.
  const ended = [...endedBlocks.keys()]
    .map((blockId) => routine.blocks.find((block) => block.id === blockId))
    .filter((block) => block !== undefined);
  const pieces = [
    ...dayPieces(routine).filter((piece) => !endedBlocks.has(piece.block.id)),
    ...(nowOffset <= routineSpan(routine)
      ? stackUpFrom(nowOffset, ended, routine)
      : stackDown(ended, routine, endedBlocks)),
  ].sort((first, second) => first.start - second.start);
  return pieces.map((piece) => ({
    block: piece.block,
    key: piece.key,
    top: toPixels(piece.start),
    height: toPixels(piece.end - piece.start),
    isNow: isHappening(piece.block, nowMinutes),
  }));
}

/**
 * Pixel offset of the "now" line, or undefined outside the routine day.
 * @example nowLineOffset(weekdays, 850) // 296
 */
export function nowLineOffset(routine: Routine, nowMinutes: number): number | undefined {
  const offset = offsetInDay(nowMinutes, routine);
  return offset > routineSpan(routine) ? undefined : toPixels(offset);
}

/**
 * How much of the routine day has passed, 0 to 100; 100 once it is over, 0 before it begins.
 * @example dayProgress(weekdays, 850) // 69
 */
export function dayProgress(routine: Routine, nowMinutes: number): number {
  const offset = offsetInDay(nowMinutes, routine);
  const span = routineSpan(routine);
  if (offset <= span) return Math.round((offset / span) * 100);
  const sinceEnd = clockDistance(toMinutes(routine.end), nowMinutes);
  const untilStart = clockDistance(nowMinutes, toMinutes(routine.start));
  return sinceEnd < untilStart ? 100 : 0;
}

/**
 * The block running at a given minute, if any.
 * @example currentBlock(weekdays, 850)?.name // 'C# study'
 */
export function currentBlock(
  routine: Pick<Routine, 'blocks'>,
  nowMinutes: number,
): RoutineBlock | undefined {
  return routine.blocks.find((block) => isHappening(block, nowMinutes));
}

/**
 * Elapsed share of a running block, 0 to 100; works for blocks that cross midnight.
 * @example blockElapsed({ start: '13:30', end: '15:00' }, 850) // 44
 */
export function blockElapsed(
  block: Pick<RoutineBlock, 'start' | 'end'>,
  nowMinutes: number,
): number {
  const length = Math.max(1, blockLength(block));
  const elapsed = clockDistance(toMinutes(block.start), nowMinutes);
  return Math.round(Math.min(1, elapsed / length) * 100);
}

/**
 * Minutes until a running block ends, never negative; works for blocks that cross midnight.
 * @example minutesLeft({ start: '13:30', end: '15:00' }, 850) // 50
 */
export function minutesLeft(
  block: Pick<RoutineBlock, 'start' | 'end'>,
  nowMinutes: number,
): number {
  return Math.max(0, blockLength(block) - clockDistance(toMinutes(block.start), nowMinutes));
}

/**
 * Ended blocks from the latest to the earliest, each ending where it ended (never past `limit`,
 * the "now" line, nor past the top of the one below it) and at least one line tall.
 */
function stackUpFrom(limit: number, blocks: readonly RoutineBlock[], routine: Routine): DayPiece[] {
  let ceiling = limit;
  return (
    [...blocks]
      .map((block, order) => ({ block, order, ...actualSpan(block, routine) }))
      // Latest end first; on a tie the one that started, or was ended, later sits lowest.
      .sort(
        (first, second) =>
          second.end - first.end || second.start - first.start || second.order - first.order,
      )
      .map(({ block, start, end }) => {
        const bottom = Math.min(end, ceiling);
        const top = Math.max(0, Math.min(start, bottom - MIN_ENDED_BLOCK_MINUTES));
        ceiling = top;
        return { block, key: `${block.id}#0`, start: top, end: bottom };
      })
  );
}

/** Ended blocks at their planned length, each starting no earlier than the one above ends. */
function stackDown(
  blocks: readonly RoutineBlock[],
  routine: Routine,
  plannedLengths: ReadonlyMap<string, number>,
): DayPiece[] {
  const span = routineSpan(routine);
  let floor = 0;
  return [...blocks]
    .map((block) => ({ block, ...actualSpan(block, routine) }))
    .sort((first, second) => first.start - second.start)
    .map(({ block, start, end }) => {
      // Zero means "unknown", so fall back to how long the block actually ran.
      const length = plannedLengths.get(block.id) || end - start;
      const top = Math.min(span, Math.max(start, floor));
      floor = Math.min(span, top + length);
      return { block, key: `${block.id}#0`, start: top, end: floor };
    });
}

function actualSpan(block: RoutineBlock, routine: Routine): { start: number; end: number } {
  const start = offsetInDay(toMinutes(block.start), routine);
  return { start, end: start + blockLength(block) };
}

function toPixels(minutes: number): number {
  return Math.round((minutes / MINUTES_PER_HOUR) * TIMELINE_HOUR_HEIGHT);
}
