import {
  GOAL_PERIODS,
  GOAL_TYPE_LABELS,
  Goal,
  GoalPeriod,
  GoalType,
} from '../../../core/routines/goal';

export type PeriodFilter = 'all' | GoalPeriod;
export type TypeFilter = 'all' | GoalType;

export interface PeriodFilterOption {
  readonly value: PeriodFilter;
  readonly label: string;
  readonly count: number;
}

export const TYPE_FILTERS: readonly { readonly value: TypeFilter; readonly label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'frequency', label: GOAL_TYPE_LABELS.frequency },
  { value: 'objective', label: GOAL_TYPE_LABELS.objective },
];

/**
 * Whether a goal passes both the period and the type filter.
 * @example matchesFilters(goal, 'weekly', 'all') // true for a weekly goal
 */
export function matchesFilters(goal: Goal, period: PeriodFilter, type: TypeFilter): boolean {
  return (period === 'all' || goal.period === period) && (type === 'all' || goal.type === type);
}

/**
 * Period chips with how many goals each would show under the current type filter.
 * @example periodFilterOptions(goals, 'all')[0] // { value: 'all', label: 'All', count: 3 }
 */
export function periodFilterOptions(
  goals: readonly Goal[],
  type: TypeFilter,
): PeriodFilterOption[] {
  const options: { value: PeriodFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    ...GOAL_PERIODS.map((period) => ({
      value: period.value,
      label: period.value === 'custom' ? 'Custom' : period.label,
    })),
  ];
  return options.map((option) => ({
    ...option,
    count: goals.filter((goal) => matchesFilters(goal, option.value, type)).length,
  }));
}
