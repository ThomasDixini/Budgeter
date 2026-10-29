import { DayPiece } from './day-clock';

/**
 * How moments of the routine day map to drawn positions (both in minutes from the day's start)
 * once the timeline makes room for the blocks ended today, which stack up above the "now" line.
 */
export interface TimelineStretch {
  /** Drawn position of a moment of the routine day. */
  readonly at: (offset: number) => number;
  /** Added to every ended block of the stack, so the stack starts where the room begins. */
  readonly stackShift: number;
}

export const NO_STRETCH: TimelineStretch = { at: (offset) => offset, stackShift: 0 };

/**
 * Room for the stack of ended blocks. When it would climb over a block still pending (or past the
 * top of the day), the stretch between that block's end and "now" grows to fit it, and everything
 * after "now" moves down by the same amount, so no block is drawn over another.
 * @example stretchForStack([gym18to19], [stack1842to1942], 1182).at(1182) // 1200: "now" moved down 18 minutes
 */
export function stretchForStack(
  pending: readonly DayPiece[],
  stack: readonly DayPiece[],
  now: number,
): TimelineStretch {
  const floor = Math.max(
    0,
    ...pending.filter((piece) => piece.end <= now).map((piece) => piece.end),
  );
  const stackTop = Math.min(now, ...stack.map((piece) => piece.start));
  if (stackTop >= floor) return NO_STRETCH;
  const needed = now - stackTop;
  return {
    at: (offset) => stretchedOffset(offset, floor, now, needed),
    stackShift: floor - stackTop,
  };
}

/** Before `floor` nothing moves; up to `now` the time spreads over `needed`; after it, all shifts. */
function stretchedOffset(offset: number, floor: number, now: number, needed: number): number {
  if (offset <= floor) return offset;
  if (offset > now) return offset + needed - (now - floor);
  return floor + ((offset - floor) / (now - floor)) * needed;
}
