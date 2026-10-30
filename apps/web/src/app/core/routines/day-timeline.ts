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
import { pieceLanes } from './day-lanes';
import { Routine, RoutineBlock } from './routine';
import { NO_STRETCH, TimelineStretch, stretchForStack } from './timeline-stretch';

/** Vertical pixels per hour on the Today timeline. */
export const TIMELINE_HOUR_HEIGHT = 48;
/**
 * Below this height a block cannot fit its name and time on two lines with padding, so it is
 * drawn on one compact line (about 80 minutes at 48px per hour).
 */
const COMPACT_BLOCK_MAX_HEIGHT = 64;
/** Shortest time an ended block is drawn with, so one finished in a minute still shows (24px). */
const MIN_ENDED_BLOCK_MINUTES = 30;
/** Short ended blocks share a row side by side, so a run of quick completions stays compact. */
const SHORT_BLOCKS_PER_ROW = 4;

/**
 * Whether a timeline block is too short for the two-line layout.
 * @example isCompactBlock(24) // true (a 30-minute block)
 */
export function isCompactBlock(heightPixels: number): boolean {
  return heightPixels < COMPACT_BLOCK_MAX_HEIGHT;
}
const MINUTES_PER_HOUR = 60;
const PERCENT = 100;

export interface TimelineHour {
  readonly label: string;
  readonly top: number;
}

/**
 * A block (or one piece of a block wrapping around a 24-hour day) on the Today timeline:
 * `top`/`height` in pixels, full width unless it shares the time with another block.
 */
export interface TimelineBlock {
  readonly block: RoutineBlock;
  /** Unique per entry; a wrapping block yields two. */
  readonly key: string;
  readonly top: number;
  readonly height: number;
  /** Left edge and width in percent of the row; short ended blocks share a row. */
  readonly left: number;
  readonly width: number;
  readonly isNow: boolean;
}

/** A piece placed on the timeline, in the column it takes when blocks share a row. */
interface PlacedPiece extends DayPiece {
  readonly column: number;
  readonly columns: number;
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

/** Everything the Today timeline draws, in pixels, once room is made for the ended blocks. */
export interface TimelineLayout {
  readonly height: number;
  readonly hours: readonly TimelineHour[];
  /** Undefined outside the routine day. */
  readonly nowOffset: number | undefined;
  readonly blocks: readonly TimelineBlock[];
}

/**
 * The timeline of a routine day with its blocks, flagging the ones happening now. Blocks completed
 * or skipped today are keys of `endedBlocks`, mapped to their planned length:
 * - while the day is running they stack upward from the "now" line, each at least one line tall;
 *   when the stack would cover a block still pending, the hours before "now" spread out to fit it;
 * - outside the day (no "now" line) they are drawn at their planned length, stacked downward.
 * @example timelineLayout(weekdays, 850).blocks.find((item) => item.isNow)?.block.name // 'C# study'
 */
export function timelineLayout(
  routine: Routine,
  nowMinutes: number,
  endedBlocks: ReadonlyMap<string, number> = new Map(),
): TimelineLayout {
  const nowOffset = offsetInDay(nowMinutes, routine);
  const pending = dayPieces(routine)
    .filter((piece) => !endedBlocks.has(piece.block.id))
    .map(fullWidth);
  const ended = endedInOrder(routine, endedBlocks);
  if (nowOffset > routineSpan(routine)) {
    const stacked = stackDown(ended, routine, endedBlocks).map(fullWidth);
    return drawLayout(routine, nowMinutes, [...pending, ...stacked], NO_STRETCH);
  }
  const stack = stackUpFrom(nowOffset, ended, routine);
  const stretch = stretchForStack(pending, stack, nowOffset);
  const pieces = [
    ...pending.map((piece) => ({
      ...piece,
      start: stretch.at(piece.start),
      end: stretch.at(piece.end),
    })),
    ...stack.map((piece) => ({ ...piece, ...stretch.placeEnded(piece) })),
  ];
  return drawLayout(routine, nowMinutes, pieces, stretch);
}

/**
 * Blocks placed on the timeline; see `timelineLayout`.
 * @example timelineBlocks(weekdays, 850).find((item) => item.isNow)?.block.name // 'C# study'
 */
export function timelineBlocks(
  routine: Routine,
  nowMinutes: number,
  endedBlocks: ReadonlyMap<string, number> = new Map(),
): TimelineBlock[] {
  return [...timelineLayout(routine, nowMinutes, endedBlocks).blocks];
}

function drawLayout(
  routine: Routine,
  nowMinutes: number,
  pieces: readonly PlacedPiece[],
  stretch: TimelineStretch,
): TimelineLayout {
  const nowOffset = offsetInDay(nowMinutes, routine);
  const span = routineSpan(routine);
  return {
    height: toPixels(stretch.at(span)),
    hours: hourMarks(routine).map(({ label, offset }) => ({
      label,
      top: toPixels(stretch.at(offset)),
    })),
    nowOffset: nowOffset > span ? undefined : toPixels(stretch.at(nowOffset)),
    blocks: inLanes(pieces)
      .sort((first, second) => first.start - second.start)
      .map((piece) => toTimelineBlock(piece, nowMinutes)),
  };
}

/**
 * Blocks that overlap in time (a podcast during work) share the width side by side, as drawn, so
 * neither covers the other. Short ended blocks already sharing a row keep their columns.
 */
function inLanes(pieces: readonly PlacedPiece[]): PlacedPiece[] {
  const lanes = pieceLanes(pieces.filter((piece) => piece.columns === 1));
  return pieces.map((piece) => {
    const placement = piece.columns === 1 ? lanes.get(piece.key) : undefined;
    return placement === undefined
      ? piece
      : { ...piece, column: placement.lane, columns: placement.lanes };
  });
}

function toTimelineBlock(piece: PlacedPiece, nowMinutes: number): TimelineBlock {
  return {
    block: piece.block,
    key: piece.key,
    top: toPixels(piece.start),
    height: toPixels(piece.end - piece.start),
    left: (piece.column / piece.columns) * PERCENT,
    width: PERCENT / piece.columns,
    isNow: isHappening(piece.block, nowMinutes),
  };
}

function fullWidth(piece: DayPiece): PlacedPiece {
  return { ...piece, column: 0, columns: 1 };
}

/** Ended blocks in the order they were ended, which breaks ties when several end at the same minute. */
function endedInOrder(routine: Routine, endedBlocks: ReadonlyMap<string, number>): RoutineBlock[] {
  return [...endedBlocks.keys()]
    .map((blockId) => routine.blocks.find((block) => block.id === blockId))
    .filter((block) => block !== undefined);
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
function stackUpFrom(
  limit: number,
  blocks: readonly RoutineBlock[],
  routine: Routine,
): PlacedPiece[] {
  let ceiling = limit;
  const sorted = [...blocks]
    .map((block, order) => ({ block, order, ...actualSpan(block, routine) }))
    // Latest end first; on a tie the one that started, or was ended, later sits lowest.
    .sort(
      (first, second) =>
        second.end - first.end || second.start - first.start || second.order - first.order,
    );
  return groupShortRows(sorted).flatMap((row) => {
    const bottom = Math.min(Math.max(...row.map((entry) => entry.end)), ceiling);
    const rowStart = Math.min(...row.map((entry) => entry.start));
    // May go above the start of the day: the timeline then stretches to fit (`stretchForStack`).
    const top = Math.min(rowStart, bottom - MIN_ENDED_BLOCK_MINUTES);
    ceiling = top;
    // Oldest on the left: the row was built latest first.
    return [...row].reverse().map(({ block }, column) => ({
      block,
      key: `${block.id}#0`,
      start: top,
      end: bottom,
      column,
      columns: row.length,
    }));
  });
}

interface StackEntry {
  readonly block: RoutineBlock;
  readonly start: number;
  readonly end: number;
}

/** Rows of ended blocks, latest first; runs of blocks shorter than a line share a row. */
function groupShortRows(entries: readonly StackEntry[]): StackEntry[][] {
  const rows: StackEntry[][] = [];
  for (const entry of entries) {
    const last = rows.at(-1);
    const fits =
      isShort(entry) &&
      last !== undefined &&
      last.length < SHORT_BLOCKS_PER_ROW &&
      last.every(isShort);
    if (fits) last.push(entry);
    else rows.push([entry]);
  }
  return rows;
}

function isShort(entry: StackEntry): boolean {
  return entry.end - entry.start < MIN_ENDED_BLOCK_MINUTES;
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
