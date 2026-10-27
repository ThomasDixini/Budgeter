import { DayPiece } from './day-clock';

/** Where a piece sits among the pieces it overlaps: lane `lane` (0-based) of `lanes`. */
export interface LanePlacement {
  readonly lane: number;
  readonly lanes: number;
}

/** Placement of a piece that overlaps nothing. */
export const SINGLE_LANE: LanePlacement = { lane: 0, lanes: 1 };

/**
 * Spreads overlapping pieces over side-by-side lanes, keyed by piece key. Pieces that overlap
 * nothing get the whole width (one lane); each group of overlapping pieces shares as many lanes
 * as it needs.
 * @example pieceLanes(dayPieces(withPodcast)).get('podcast#1') // { lane: 1, lanes: 2 }
 */
export function pieceLanes(pieces: readonly DayPiece[]): Map<string, LanePlacement> {
  const placements = new Map<string, LanePlacement>();
  const sorted = [...pieces].sort((first, second) => first.start - second.start);
  for (const group of overlapGroups(sorted)) {
    const lanes = laneIndexes(group);
    const laneCount = Math.max(...lanes.values()) + 1;
    for (const [key, lane] of lanes) placements.set(key, { lane, lanes: laneCount });
  }
  return placements;
}

/**
 * Most lanes any group of overlapping pieces needs, at least one.
 * @example maxLanes(dayPieces(withPodcast)) // 2
 */
export function maxLanes(pieces: readonly DayPiece[]): number {
  return Math.max(1, ...[...pieceLanes(pieces).values()].map((placement) => placement.lanes));
}

/** Splits pieces sorted by start into runs where each piece overlaps the run before it. */
function overlapGroups(sorted: readonly DayPiece[]): DayPiece[][] {
  const groups: DayPiece[][] = [];
  let groupEnd = -1;
  for (const piece of sorted) {
    if (groups.length === 0 || piece.start >= groupEnd) groups.push([]);
    groups[groups.length - 1].push(piece);
    groupEnd = Math.max(groupEnd, piece.end);
  }
  return groups;
}

/** Puts each piece in the first lane free at its start, opening a lane when none is. */
function laneIndexes(group: readonly DayPiece[]): Map<string, number> {
  const laneEnds: number[] = [];
  const lanes = new Map<string, number>();
  for (const piece of group) {
    const free = laneEnds.findIndex((laneEnd) => laneEnd <= piece.start);
    const lane = free === -1 ? laneEnds.length : free;
    laneEnds[lane] = piece.end;
    lanes.set(piece.key, lane);
  }
  return lanes;
}
