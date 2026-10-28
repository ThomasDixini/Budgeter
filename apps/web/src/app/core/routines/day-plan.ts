import { formatClock, toMinutes } from '../calendar/time-of-day';
import { MINUTES_PER_DAY, blockLength, offsetInDay } from './day-clock';
import { Routine, RoutineBlock } from './routine';

export type BlockOutcomeKind = 'done' | 'skipped';

/** A routine block completed or skipped today, and the `HH:MM` time it ended. */
export interface BlockOutcome {
  readonly routineId: string;
  readonly blockId: string;
  readonly outcome: BlockOutcomeKind;
  readonly at: string;
}

/** Today's version of a routine, after completing or skipping blocks, with how each block ended. */
export interface DayPlan {
  readonly routine: Routine;
  readonly outcomes: ReadonlyMap<string, BlockOutcomeKind>;
  /** Planned length in minutes of each block that ended today, before it was cut short. */
  readonly plannedLengths: ReadonlyMap<string, number>;
}

/** A block placed in minutes from the start of the routine day. */
interface Span {
  readonly block: RoutineBlock;
  readonly start: number;
  readonly end: number;
}

/**
 * Applies today's outcomes to a routine: a block completed or skipped early ends when it was,
 * and every block that was still ahead moves earlier by the time saved. Only today's view
 * changes; the stored routine stays as it is.
 * @example planDay(weekdays, [{ routineId: 'weekdays', blockId: 'project', outcome: 'done', at: '20:40' }])
 */
export function planDay(routine: Routine, outcomes: readonly BlockOutcome[]): DayPlan {
  const own = outcomes
    .filter((outcome) => outcome.routineId === routine.id)
    .sort((first, second) => offsetOf(first.at, routine) - offsetOf(second.at, routine));
  const initial = routine.blocks.map((block): Span => {
    const start = offsetOf(block.start, routine);
    return { block, start, end: start + blockLength(block) };
  });
  const spans = own.reduce(
    (current, outcome) => endEarly(current, outcome.blockId, offsetOf(outcome.at, routine)),
    initial,
  );
  return {
    routine: { ...routine, blocks: spans.map((span) => toBlock(span, routine)) },
    outcomes: new Map(own.map((outcome) => [outcome.blockId, outcome.outcome])),
    plannedLengths: new Map(
      initial
        .filter((span) => own.some((outcome) => outcome.blockId === span.block.id))
        .map((span) => [span.block.id, span.end - span.start]),
    ),
  };
}

/** Ends a block at `at` and pulls every block that started after its old end earlier. */
function endEarly(spans: readonly Span[], blockId: string, at: number): Span[] {
  const target = spans.find((span) => span.block.id === blockId);
  if (target === undefined) return [...spans];
  const end = Math.min(target.end, Math.max(target.start, at));
  const saved = target.end - end;
  return spans.map((span) => {
    if (span === target) return { ...span, end };
    if (span.start < target.end) return span;
    return { ...span, start: span.start - saved, end: span.end - saved };
  });
}

function toBlock(span: Span, routine: Routine): RoutineBlock {
  const dayStart = toMinutes(routine.start);
  return {
    ...span.block,
    start: formatClock((dayStart + span.start) % MINUTES_PER_DAY),
    end: formatClock((dayStart + span.end) % MINUTES_PER_DAY),
  };
}

function offsetOf(clock: string, routine: Routine): number {
  return offsetInDay(toMinutes(clock), routine);
}
