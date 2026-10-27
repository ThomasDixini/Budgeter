import { weekdayIndex } from '../calendar/time-of-day';
import { WEEKDAY_LABELS, weekdaysLabel } from './routine';

/** How often a task shows up on the Today list. */
export type TaskRepeat = 'once' | 'daily' | 'weekly';

/** A to-do for the Today list: once on a date, every day, or on some weekdays. */
export interface Task {
  readonly id: string;
  readonly title: string;
  readonly categoryId?: string;
  readonly repeat: TaskRepeat;
  /** Weekday indexes (Monday = 0) of a weekly task; empty otherwise. */
  readonly days: readonly number[];
  /** ISO date (`YYYY-MM-DD`) of a task that happens once. */
  readonly date?: string;
}

export type TaskDraft = Omit<Task, 'id'>;

/** Choices of the "Repeat" control, in display order. */
export const TASK_REPEAT_OPTIONS: readonly {
  readonly value: TaskRepeat;
  readonly label: string;
}[] = [
  { value: 'once', label: 'Only today' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Some days' },
];

/**
 * Whether a task shows up on a day, given that day's ISO date.
 * @example occursOn(gymMonWedFri, new Date(2026, 9, 26), '2026-10-26') // true (a Monday)
 */
export function occursOn(task: Task, day: Date, isoDay: string): boolean {
  if (task.repeat === 'daily') return true;
  if (task.repeat === 'once') return task.date === isoDay;
  return task.days.includes(weekdayIndex(day));
}

/**
 * Short description of how often a task repeats.
 * @example repeatLabel({ repeat: 'weekly', days: [0, 2, 4] }) // 'Mon, Wed, Fri'
 */
export function repeatLabel(task: Pick<Task, 'repeat' | 'days'>): string {
  if (task.repeat === 'daily') return 'Every day';
  if (task.repeat === 'once') return 'Only today';
  return task.days.length === WEEKDAY_LABELS.length ? 'Every day' : weekdaysLabel(task.days);
}
