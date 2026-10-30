import { formatDate } from '@angular/common';

export type GoalType = 'frequency' | 'objective';
export type GoalPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

/**
 * Something to repeat (frequency) or reach (objective) within a period. A frequency goal counts the
 * routine blocks of its category completed in the period; an objective is marked achieved by hand.
 */
export interface Goal {
  readonly id: string;
  readonly categoryId: string;
  readonly title: string;
  readonly type: GoalType;
  readonly period: GoalPeriod;
  /**
   * Blocks completed in the period of the day asked for (it may go past the target); for an
   * objective, the target once achieved and zero before.
   */
  readonly done: number;
  readonly target: number;
  /** What an objective counts, e.g. "books"; kept from goals set before objectives were marked by hand. */
  readonly unit?: string;
  /** ISO date (`YYYY-MM-DD`) closing a custom period. */
  readonly deadline?: string;
  /** ISO date an objective was marked achieved; absent while it is pending. */
  readonly achievedOn?: string;
}

/** What can be edited on a goal: everything except its type and category. */
export type GoalChanges = Pick<Goal, 'title' | 'period' | 'target' | 'unit' | 'deadline'>;

/**
 * Whether a goal is met in its period: enough blocks for a frequency goal, marked for an objective.
 * @example isGoalMet({ type: 'frequency', done: 6, target: 5 }) // true
 */
export function isGoalMet(goal: Pick<Goal, 'type' | 'done' | 'target' | 'achievedOn'>): boolean {
  if (goal.type === 'objective') return goal.achievedOn !== undefined;
  return goal.done >= goal.target;
}

/**
 * Repetitions beyond the target, zero until it is passed.
 * @example goalExtra({ done: 7, target: 5 }) // 2
 */
export function goalExtra(goal: Pick<Goal, 'done' | 'target'>): number {
  return Math.max(0, goal.done - goal.target);
}

export interface GoalPeriodInfo {
  readonly value: GoalPeriod;
  readonly label: string;
  /** Phrase after the repetition count, e.g. "times per week". */
  readonly cadence: string;
}

export const GOAL_PERIODS: readonly GoalPeriodInfo[] = [
  { value: 'daily', label: 'Daily', cadence: 'per day' },
  { value: 'weekly', label: 'Weekly', cadence: 'per week' },
  { value: 'monthly', label: 'Monthly', cadence: 'per month' },
  { value: 'yearly', label: 'Yearly', cadence: 'per year' },
  { value: 'custom', label: 'Custom period', cadence: 'in the period' },
];

export const GOAL_TYPE_LABELS: Readonly<Record<GoalType, string>> = {
  frequency: 'Frequency',
  objective: 'Objective',
};

/** Frequency goals up to this many repetitions are drawn as dots instead of a bar. */
const MAX_DOTS = 10;
const LOCALE = 'en-US';

/**
 * Period metadata for a goal period.
 * @example goalPeriodInfo('weekly').label // 'Weekly'
 */
export function goalPeriodInfo(period: GoalPeriod): GoalPeriodInfo {
  return GOAL_PERIODS.find((info) => info.value === period) ?? GOAL_PERIODS[0];
}

/**
 * Completion from 0 to 100, capped once the target is reached.
 * @example goalProgress({ ...goal, done: 3, target: 5 }) // 60
 */
export function goalProgress(goal: Pick<Goal, 'done' | 'target'>): number {
  return Math.min(100, Math.round((goal.done / goal.target) * 100));
}

/**
 * Mean completion of a set of goals; zero when there are none.
 * @example averageProgress([{ done: 1, target: 2 }, { done: 2, target: 2 }]) // 75
 */
export function averageProgress(goals: readonly Pick<Goal, 'done' | 'target'>[]): number {
  if (goals.length === 0) return 0;
  const total = goals.reduce((sum, goal) => sum + goalProgress(goal), 0);
  return Math.round(total / goals.length);
}

/**
 * Whether the goal is small enough to draw one dot per repetition.
 * @example usesDots({ type: 'frequency', target: 5 }) // true
 */
export function usesDots(goal: Pick<Goal, 'type' | 'target'>): boolean {
  return goal.type === 'frequency' && goal.target <= MAX_DOTS;
}

/**
 * Badge text naming the goal type and period.
 * @example goalTag({ type: 'frequency', period: 'weekly' }) // 'Frequency · Weekly'
 */
export function goalTag(goal: Pick<Goal, 'type' | 'period'>): string {
  return `${GOAL_TYPE_LABELS[goal.type]} · ${goalPeriodInfo(goal.period).label}`;
}

/**
 * Progress spelled out: blocks done against the target, or whether an objective was achieved.
 * @example goalValueLabel({ type: 'frequency', done: 7, target: 5 }) // '7 of 5 times'
 */
export function goalValueLabel(
  goal: Pick<Goal, 'type' | 'done' | 'target' | 'achievedOn'>,
): string {
  if (goal.type === 'objective') {
    return goal.achievedOn === undefined
      ? 'Not achieved yet'
      : `Achieved on ${shortDate(parseIsoDate(goal.achievedOn))}`;
  }
  return `${goal.done} of ${goal.target} ${goal.target === 1 ? 'time' : 'times'}`;
}

/**
 * When the goal renews or ends, or "Completed" once met (with what was done beyond the target).
 * @example goalFooter({ ...goal, period: 'weekly' }, today) // 'Renews on Sunday'
 */
export function goalFooter(goal: Goal, today: Date): string {
  if (!isGoalMet(goal)) return periodFooter(goal.period, today, goal.deadline);
  const extra = goal.type === 'frequency' ? goalExtra(goal) : 0;
  return extra > 0 ? `Completed · ${extra} extra` : 'Completed';
}

/**
 * Renewal or deadline hint for a period, shared by goal cards and the new-goal preview.
 * @example periodFooter('yearly', new Date(2026, 9, 26)) // 'until Dec 31'
 */
export function periodFooter(period: GoalPeriod, today: Date, deadline?: string): string {
  switch (period) {
    case 'daily':
      return 'Renews every day';
    case 'weekly':
      return 'Renews on Sunday';
    case 'monthly':
      return `Renews on ${shortDate(new Date(today.getFullYear(), today.getMonth() + 1, 1))}`;
    case 'yearly':
      return `until ${shortDate(new Date(today.getFullYear(), 11, 31))}`;
    case 'custom':
      return deadline === undefined ? '' : `until ${shortDate(parseIsoDate(deadline))}`;
  }
}

/**
 * Local date for an ISO `YYYY-MM-DD` string (avoids the UTC shift of `new Date(iso)`).
 * @example parseIsoDate('2026-12-15').getDate() // 15
 */
export function parseIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Short month-and-day label.
 * @example shortDate(new Date(2026, 11, 15)) // 'Dec 15'
 */
export function shortDate(date: Date): string {
  return formatDate(date, 'MMM d', LOCALE);
}
