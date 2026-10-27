import { formatClock, toMinutes } from '../calendar/time-of-day';
import {
  Routine,
  RoutineBlock,
  SINGLE_LANE,
  blockLanes,
  blockMinutesWithin,
  maxLanes,
  routineSpan,
  visibleBlocks,
} from './routine';

/** Length given to a freshly added block. */
const NEW_BLOCK_MINUTES = 60;

export type BlockChanges = Partial<Omit<RoutineBlock, 'id'>>;

/**
 * Where a block sits on the horizontal partition bar: `left`/`width` in percent of the routine
 * day, `top`/`height` in percent of the bar so overlapping blocks stack in lanes.
 */
export interface PartitionSegment {
  readonly block: RoutineBlock;
  readonly left: number;
  readonly width: number;
  readonly top: number;
  readonly height: number;
}

/**
 * Adds the weekday when missing, removes it when present.
 * @example toggleDay(weekdays, 5).days // [0, 1, 2, 3, 4, 5]
 */
export function toggleDay(routine: Routine, day: number): Routine {
  const days = routine.days.includes(day)
    ? routine.days.filter((current) => current !== day)
    : [...routine.days, day];
  return { ...routine, days };
}

/**
 * Applies changes to one block, leaving the others untouched.
 * @example updateBlock(weekdays, 'lunch', { end: '14:00' })
 */
export function updateBlock(routine: Routine, blockId: string, changes: BlockChanges): Routine {
  const blocks = routine.blocks.map((block) =>
    block.id === blockId ? { ...block, ...changes } : block,
  );
  return { ...routine, blocks };
}

/**
 * Drops a block from the routine.
 * @example removeBlock(weekdays, 'lunch').blocks.length // 3
 */
export function removeBlock(routine: Routine, blockId: string): Routine {
  return { ...routine, blocks: routine.blocks.filter((block) => block.id !== blockId) };
}

/**
 * Appends a one-hour block starting where the latest block ends.
 * @example appendBlock(weekdays, 'block-9').blocks.at(-1)?.start // '17:00'
 */
export function appendBlock(routine: Routine, blockId: string): Routine {
  const lastEnd = routine.blocks.reduce(
    (latest, block) => Math.max(latest, toMinutes(block.end)),
    toMinutes(routine.start),
  );
  const block: RoutineBlock = {
    id: blockId,
    name: 'New block',
    start: formatClock(lastEnd),
    end: formatClock(lastEnd + NEW_BLOCK_MINUTES),
  };
  return { ...routine, blocks: [...routine.blocks, block] };
}

/**
 * Blocks laid out on the partition bar; blocks outside the routine day are left out.
 * @example partitionSegments(weekdays)[0] // { block: work, left: 0, width: 44.44, top: 0, height: 100 }
 */
export function partitionSegments(routine: Routine): PartitionSegment[] {
  const start = toMinutes(routine.start);
  const span = routineSpan(routine);
  const visible = visibleBlocks(routine);
  const lanes = blockLanes(visible);
  return visible.map((block) => {
    const { lane, lanes: laneCount } = lanes.get(block.id) ?? SINGLE_LANE;
    return {
      block,
      left: ((Math.max(toMinutes(block.start), start) - start) / span) * 100,
      width: (blockMinutesWithin(block, routine) / span) * 100,
      top: (lane / laneCount) * 100,
      height: 100 / laneCount,
    };
  });
}

/**
 * Lanes the partition bar needs to stack every overlap, so it can grow to fit them.
 * @example partitionLaneCount(weekdaysWithPodcast) // 2
 */
export function partitionLaneCount(routine: Routine): number {
  return maxLanes(visibleBlocks(routine));
}
