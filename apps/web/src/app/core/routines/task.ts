import { weekdayIndex } from '../calendar/time-of-day';
import { parseIsoDate, shortDate } from './goal';
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
  { value: 'once', label: 'One time' },
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
 * Short description of how often a task repeats, or on which day a one-off task is.
 * @example repeatLabel({ repeat: 'weekly', days: [0, 2, 4] }) // 'Mon, Wed, Fri'
 * @example repeatLabel({ repeat: 'once', days: [], date: '2026-10-30' }, '2026-10-28') // 'Oct 30'
 */
export function repeatLabel(
  task: Pick<Task, 'repeat' | 'days' | 'date'>,
  todayIso?: string,
): string {
  if (task.repeat === 'daily') return 'Every day';
  if (task.repeat === 'once') return onceLabel(task.date, todayIso);
  return task.days.length === WEEKDAY_LABELS.length ? 'Every day' : weekdaysLabel(task.days);
}

function onceLabel(date: string | undefined, todayIso: string | undefined): string {
  if (date === undefined || date === todayIso) return 'Today';
  return shortDate(parseIsoDate(date));
}

/** Where a task that is not due today sits in the "Not today" list. */
export type NotTodayGroup = 'scheduled' | 'repeating' | 'past';

export interface NotTodayTask {
  readonly task: Task;
  readonly group: NotTodayGroup;
}

const GROUP_ORDER: readonly NotTodayGroup[] = ['scheduled', 'repeating', 'past'];

/**
 * The tasks that are not due on a day, so they can still be edited or deleted: one-off tasks
 * scheduled ahead (soonest first), then repeating tasks, then one-off tasks whose day has passed
 * (latest first). Whether a past task was ever done is not known here, so none is marked as missed.
 * @example tasksNotToday(tasks, new Date(2026, 9, 28), '2026-10-28').map((item) => item.group)
 */
export function tasksNotToday(tasks: readonly Task[], day: Date, isoDay: string): NotTodayTask[] {
  return tasks
    .filter((task) => !occursOn(task, day, isoDay))
    .map((task): NotTodayTask => ({ task, group: groupOf(task, isoDay) }))
    .sort((first, second) => compareNotToday(first, second));
}

function groupOf(task: Task, isoDay: string): NotTodayGroup {
  if (task.repeat !== 'once') return 'repeating';
  return (task.date ?? isoDay) < isoDay ? 'past' : 'scheduled';
}

function compareNotToday(first: NotTodayTask, second: NotTodayTask): number {
  const byGroup = GROUP_ORDER.indexOf(first.group) - GROUP_ORDER.indexOf(second.group);
  if (byGroup !== 0) return byGroup;
  const firstDate = first.task.date ?? '';
  const secondDate = second.task.date ?? '';
  if (first.group === 'past') return secondDate.localeCompare(firstDate);
  if (first.group === 'scheduled') return firstDate.localeCompare(secondDate);
  return first.task.title.localeCompare(second.task.title);
}
