import { formatClock, toMinutes } from '../calendar/time-of-day';
import type { Routine, RoutineBlock } from './routine';

/*
 * Clock math on a 24-hour circle. An end at or before its start runs past midnight, so a day
 * from 00:00 to 00:00 lasts 24h and a block from 22:00 to 06:00 lasts 8h. Positions are offsets
 * in minutes from the start of the routine day.
 */

export const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_HOUR = 60;

type TimeRange = Pick<Routine, 'start' | 'end'>;

/** A stretch of a block inside the routine day; a block crossing the day's edge has two. */
export interface DayPiece {
  readonly block: RoutineBlock;
  /** Unique per piece, for tracking in templates and lane lookups. */
  readonly key: string;
  readonly start: number;
  readonly end: number;
}

/**
 * Minutes from one clock time forward to another, wrapping past midnight.
 * @example clockDistance(1320, 360) // 480 (22:00 → 06:00)
 */
export function clockDistance(fromMinutes: number, toMinutesOfDay: number): number {
  return (((toMinutesOfDay - fromMinutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/**
 * Length of the routine day; an end equal to the start means the whole 24 hours.
 * @example routineSpan({ start: '00:00', end: '00:00' }) // 1440
 */
export function routineSpan(routine: TimeRange): number {
  return clockDistance(toMinutes(routine.start), toMinutes(routine.end)) || MINUTES_PER_DAY;
}

/**
 * Length of a block; one that ends when it starts has none.
 * @example blockLength({ start: '22:00', end: '06:00' }) // 480
 */
export function blockLength(block: TimeRange): number {
  return clockDistance(toMinutes(block.start), toMinutes(block.end));
}

/**
 * Offset of a clock time from the start of the routine day.
 * @example offsetInDay(870, { start: '08:00', end: '17:00' }) // 390
 */
export function offsetInDay(minutesOfDay: number, routine: TimeRange): number {
  return clockDistance(toMinutes(routine.start), minutesOfDay);
}

/**
 * Stretches of a block inside the routine day: none outside it, two when a block wraps
 * around the edge of a 24-hour day (e.g. sleep 22:00–06:00 on a 00:00–00:00 day).
 * @example blockPieces(sleep, fullDay) // [{ start: 0, end: 360 }, { start: 1320, end: 1440 }]
 */
export function blockPieces(block: RoutineBlock, routine: TimeRange): DayPiece[] {
  const span = routineSpan(routine);
  const start = offsetInDay(toMinutes(block.start), routine);
  const length = blockLength(block);
  return [start - MINUTES_PER_DAY, start]
    .map((shiftedStart) => ({
      start: Math.max(0, shiftedStart),
      end: Math.min(span, shiftedStart + length),
    }))
    .filter((piece) => piece.end > piece.start)
    .map((piece, index) => ({ ...piece, block, key: `${block.id}#${index}` }));
}

/**
 * Minutes of a block that fall inside the routine day.
 * @example blockMinutesWithin({ start: '13:30', end: '15:00' }, weekdays) // 90
 */
export function blockMinutesWithin(block: RoutineBlock, routine: TimeRange): number {
  return blockPieces(block, routine).reduce((sum, piece) => sum + piece.end - piece.start, 0);
}

/**
 * Every piece of every block inside the routine day, by position.
 * @example dayPieces(weekdays)[0].block.name // 'Work'
 */
export function dayPieces(routine: Routine): DayPiece[] {
  return routine.blocks
    .flatMap((block) => blockPieces(block, routine))
    .sort((first, second) => first.start - second.start);
}

/**
 * Whether a block is running at a clock time, including blocks that cross midnight.
 * @example isHappening({ start: '22:00', end: '06:00' }, 120) // true
 */
export function isHappening(block: TimeRange, minutesOfDay: number): boolean {
  return clockDistance(toMinutes(block.start), minutesOfDay) < blockLength(block);
}

/**
 * Clock hours of the routine day, every `stepHours`, with their offset; the end of a
 * midnight-to-midnight day reads 24:00.
 * @example hourMarks({ start: '23:30', end: '01:00' }) // [{ label: '00:00', offset: 30 }, { label: '01:00', offset: 90 }]
 */
export function hourMarks(
  routine: TimeRange,
  stepHours = 1,
): { readonly label: string; readonly offset: number }[] {
  const start = toMinutes(routine.start);
  const span = routineSpan(routine);
  const step = stepHours * MINUTES_PER_HOUR;
  const marks: { label: string; offset: number }[] = [];
  for (let offset = clockDistance(start, 0) % step; offset <= span; offset += step) {
    const isMidnightEnd = offset === span && start + offset === MINUTES_PER_DAY;
    marks.push({
      label: isMidnightEnd ? '24:00' : formatClock((start + offset) % MINUTES_PER_DAY),
      offset,
    });
  }
  return marks;
}
