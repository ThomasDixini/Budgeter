import { DayPiece } from './day-clock';

type Span = Pick<DayPiece, 'start' | 'end'>;

/**
 * How moments of the routine day map to drawn positions (both in minutes from the day's start)
 * once the timeline makes room for the blocks ended today that stack up above the "now" line.
 */
export interface TimelineStretch {
  /** Drawn position of a moment of the routine day, for pending blocks, hour lines and "now". */
  readonly at: (offset: number) => number;
  /**
   * Drawn span of an ended block: one stacked against the "now" line moves into the room made for
   * the stack; one ended in its own slot (a past block completed later) stays where it was planned.
   */
  readonly placeEnded: (piece: Span) => Span;
}

export const NO_STRETCH: TimelineStretch = {
  at: (offset) => offset,
  placeEnded: (piece) => ({ start: piece.start, end: piece.end }),
};

/**
 * Room for the stack of ended blocks. When the blocks stacked against "now" would climb over a
 * block still pending (or past the top of the day), the stretch between that block's end and "now"
 * grows to fit them, and everything after "now" moves down by the same amount, so no block is drawn
 * over another. Ended blocks drawn in their own slot are not part of the stack and need no room.
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
  const stackTop = topOfStackAgainst(now, stack);
  if (stackTop >= floor) return NO_STRETCH;
  const needed = now - stackTop;
  const at = (offset: number): number => stretchedOffset(offset, floor, now, needed);
  const shift = floor - stackTop;
  return {
    at,
    placeEnded: (piece) =>
      piece.start >= stackTop
        ? { start: piece.start + shift, end: piece.end + shift }
        : { start: at(piece.start), end: at(piece.end) },
  };
}

/**
 * Top of the ended blocks piled up against "now": from the line upward, each one reaching the one
 * below it. A block ended earlier, with a gap below it, sits in its own slot and is left out.
 */
function topOfStackAgainst(now: number, stack: readonly DayPiece[]): number {
  let top = now;
  for (const piece of [...stack].sort((first, second) => second.end - first.end)) {
    if (piece.end < top) break;
    top = Math.min(top, piece.start);
  }
  return top;
}

/** Before `floor` nothing moves; up to `now` the time spreads over `needed`; after it, all shifts. */
function stretchedOffset(offset: number, floor: number, now: number, needed: number): number {
  if (offset <= floor) return offset;
  if (offset > now) return offset + needed - (now - floor);
  return floor + ((offset - floor) / (now - floor)) * needed;
}
