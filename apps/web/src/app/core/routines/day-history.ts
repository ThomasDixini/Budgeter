import { formatDate } from '@angular/common';
import { Category, findCategory } from './category';
import { BlockOutcome, BlockOutcomeKind } from './day-plan';
import { Goal, GoalPeriod, isGoalMet, parseIsoDate, shortDate } from './goal';
import { Routine } from './routine';

const LOCALE = 'en-US';

/** A routine block as it ended on a past day. */
export interface HistoryBlock {
  readonly key: string;
  readonly name: string;
  readonly routineName: string;
  readonly outcome: BlockOutcomeKind;
  /** `HH:MM` it was completed or skipped at. */
  readonly at: string;
  readonly category?: Category;
}

/**
 * The blocks completed or skipped on a day, in the order they ended. A block or routine deleted
 * since then is still listed, by name if known.
 * @example historyBlocks(outcomes, routines, categories)[0].name // 'C# study'
 */
export function historyBlocks(
  outcomes: readonly BlockOutcome[],
  routines: readonly Routine[],
  categories: readonly Category[],
): HistoryBlock[] {
  return [...outcomes]
    .sort((first, second) => first.at.localeCompare(second.at))
    .map((outcome) => {
      const routine = routines.find((candidate) => candidate.id === outcome.routineId);
      const block = routine?.blocks.find((candidate) => candidate.id === outcome.blockId);
      return {
        key: `${outcome.routineId}/${outcome.blockId}`,
        name: block?.name ?? 'Removed block',
        routineName: routine?.name ?? 'Removed routine',
        outcome: outcome.outcome,
        at: outcome.at,
        category: findCategory(categories, block?.categoryId),
      };
    });
}

/**
 * Goals met as of a day: frequency goals that reached their target in the period around it, and
 * objectives marked achieved on that very day.
 * @example goalsMetOn(goals, '2026-10-28').map((goal) => goal.id) // ['g1', 'g3']
 */
export function goalsMetOn(goals: readonly Goal[], isoDay: string): Goal[] {
  return goals.filter((goal) =>
    goal.type === 'objective' ? goal.achievedOn === isoDay : isGoalMet(goal),
  );
}

/**
 * Frequency goals that had not reached their target in the period around the day.
 * @example goalsShortOn(goals).map((goal) => goal.id) // ['g4']
 */
export function goalsShortOn(goals: readonly Goal[]): Goal[] {
  return goals.filter((goal) => goal.type === 'frequency' && !isGoalMet(goal));
}

/**
 * The period of a goal around a day, named for the history.
 * @example historyPeriodLabel('weekly', '2026-10-28') // 'Week of Oct 26'
 */
export function historyPeriodLabel(period: GoalPeriod, isoDay: string, deadline?: string): string {
  const day = parseIsoDate(isoDay);
  switch (period) {
    case 'daily':
      return shortDate(day);
    case 'weekly':
      return `Week of ${shortDate(mondayOf(day))}`;
    case 'monthly':
      return formatDate(day, 'MMMM y', LOCALE);
    case 'yearly':
      return formatDate(day, 'y', LOCALE);
    case 'custom':
      return deadline === undefined
        ? 'Custom period'
        : `Until ${shortDate(parseIsoDate(deadline))}`;
  }
}

function mondayOf(day: Date): Date {
  const daysSinceMonday = (day.getDay() + 6) % 7;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - daysSinceMonday);
}
