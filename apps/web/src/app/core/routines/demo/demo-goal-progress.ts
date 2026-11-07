import { parseIsoDate } from '../../calendar/date-label';
import { weekdayIndex } from '../../calendar/time-of-day';
import { addDays, monthEnd } from '../../finances/demo/demo-dates';
import { BlockOutcome } from '../day-plan';
import { Goal } from '../goal';
import { Routine } from '../routine';

/** First and last ISO day of a goal's period. */
interface DayRange {
  readonly from: string;
  readonly to: string;
}

const EARLIEST_DAY = '0000-01-01';

/**
 * The days a goal counts blocks over, for the period around a day; a custom period runs up to its deadline.
 * @example periodRange({ period: 'weekly' }, '2026-11-05') // { from: '2026-11-02', to: '2026-11-08' }
 */
export function periodRange(goal: Pick<Goal, 'period' | 'deadline'>, day: string): DayRange {
  switch (goal.period) {
    case 'daily':
      return { from: day, to: day };
    case 'weekly': {
      const monday = addDays(day, -weekdayIndex(parseIsoDate(day)));
      return { from: monday, to: addDays(monday, 6) };
    }
    case 'monthly':
      return { from: `${day.slice(0, 7)}-01`, to: monthEnd(day.slice(0, 7)) };
    case 'yearly':
      return { from: `${day.slice(0, 4)}-01-01`, to: `${day.slice(0, 4)}-12-31` };
    case 'custom':
      return { from: EARLIEST_DAY, to: goal.deadline ?? day };
  }
}

function categoryOfBlock(routines: readonly Routine[], outcome: BlockOutcome): string | undefined {
  return routines
    .find((routine) => routine.id === outcome.routineId)
    ?.blocks.find((planned) => planned.id === outcome.blockId)?.categoryId;
}

/**
 * Blocks of the goal's category completed in its period around a day.
 * @example completedInPeriod(goal, '2026-11-05', routines, outcomesByDay) // 3
 */
export function completedInPeriod(
  goal: Goal,
  day: string,
  routines: readonly Routine[],
  outcomesByDay: ReadonlyMap<string, readonly BlockOutcome[]>,
): number {
  const range = periodRange(goal, day);
  let completed = 0;
  for (const [outcomeDay, outcomes] of outcomesByDay) {
    if (outcomeDay < range.from || outcomeDay > range.to) continue;
    completed += outcomes.filter(
      (outcome) =>
        outcome.outcome === 'done' && categoryOfBlock(routines, outcome) === goal.categoryId,
    ).length;
  }
  return completed;
}
