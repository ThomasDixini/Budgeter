import { toMinutes } from '../calendar/time-of-day';
import {
  DayPiece,
  blockLength,
  blockPieces,
  clockDistance,
  dayPieces,
  hourMarks,
  isHappening,
  offsetInDay,
  routineSpan,
} from './day-clock';
import { SINGLE_LANE, pieceLanes } from './day-lanes';
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
 * A block (or one piece of a block wrapping around a 24-hour day) on the Today timeline:
 * `top`/`height` in pixels, `left`/`width` in percent of the column.
 */
export interface TimelineBlock {
  readonly block: RoutineBlock;
  /** Unique per entry; a wrapping block yields two. */
  readonly key: string;
  readonly top: number;
  readonly height: number;
  readonly left: number;
  readonly width: number;
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
 * Blocks placed on the timeline, side by side where they overlap, flagging the ones happening now.
 * Blocks in `endedIds` (completed or skipped today) stay visible even when they ended right after
 * starting: they get at least a one-line height, beside the block that moved up into their time.
 * @example timelineBlocks(weekdays, 850).find((item) => item.isNow)?.block.name // 'C# study'
 */
export function timelineBlocks(
  routine: Routine,
  nowMinutes: number,
  endedIds: ReadonlySet<string> = new Set(),
): TimelineBlock[] {
  const pieces = [
    ...dayPieces(routine).filter((piece) => !endedIds.has(piece.block.id)),
    ...routine.blocks
      .filter((block) => endedIds.has(block.id))
      .flatMap((block) => endedPieces(block, routine)),
  ].sort((first, second) => first.start - second.start);
  const lanes = pieceLanes(pieces);
  return pieces.map((piece) => {
    const { lane, lanes: laneCount } = lanes.get(piece.key) ?? SINGLE_LANE;
    return {
      block: piece.block,
      key: piece.key,
      top: toPixels(piece.start),
      height: toPixels(piece.end - piece.start),
      left: (lane / laneCount) * 100,
      width: 100 / laneCount,
      isNow: isHappening(piece.block, nowMinutes),
    };
  });
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

/** Pieces of an ended block, stretched to the shortest height that still shows one line. */
function endedPieces(block: RoutineBlock, routine: Routine): DayPiece[] {
  const pieces = blockPieces(block, routine);
  if (blockLength(block) >= MIN_ENDED_BLOCK_MINUTES) return pieces;
  const start = offsetInDay(toMinutes(block.start), routine);
  const end = Math.min(routineSpan(routine), start + MIN_ENDED_BLOCK_MINUTES);
  return end > start ? [{ block, key: `${block.id}#0`, start, end }] : [];
}

function toPixels(minutes: number): number {
  return Math.round((minutes / MINUTES_PER_HOUR) * TIMELINE_HOUR_HEIGHT);
}
