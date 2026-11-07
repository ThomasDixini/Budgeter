import { Injectable, LOCALE_ID, inject } from '@angular/core';
import { Clock } from '../../calendar/clock';
import { isoDate } from '../../calendar/date-label';
import { minutesOfDay } from '../../calendar/time-of-day';
import { Category } from '../category';
import { BlockOutcome } from '../day-plan';
import { Goal } from '../goal';
import { Routine } from '../routine';
import { Task } from '../task';
import { completedInPeriod } from './demo-goal-progress';
import { buildDemoRoutines } from './demo-routines-data';

/** Replaces the record with the same id, or adds it at the end. */
export function upsertById<TRecord extends { readonly id: string }>(
  list: readonly TRecord[],
  record: TRecord,
): TRecord[] {
  return list.some((item) => item.id === record.id)
    ? list.map((item) => (item.id === record.id ? record : item))
    : [...list, record];
}

/**
 * The made-up Routines & Goals data the demo screens work on, kept in memory for as long as the page is
 * open: what is added, changed or completed in the demo stays until the page is reloaded, then starts
 * again as it was. Goal progress is worked out from the blocks completed, as the API does.
 */
@Injectable({ providedIn: 'root' })
export class DemoRoutines {
  categories: Category[];
  routines: Routine[];
  tasks: Task[];
  goals: Goal[];
  private readonly outcomes: Map<string, BlockOutcome[]>;
  private readonly completedTasks: Map<string, Set<string>>;

  constructor() {
    const now = inject(Clock).now();
    const language = inject(LOCALE_ID) === 'pt-BR' ? 'pt-BR' : 'en-US';
    const seed = buildDemoRoutines(isoDate(now), language, minutesOfDay(now));
    this.categories = [...seed.categories];
    this.routines = [...seed.routines];
    this.tasks = [...seed.tasks];
    this.goals = [...seed.goals];
    this.outcomes = new Map([...seed.outcomes].map(([day, list]) => [day, [...list]]));
    this.completedTasks = new Map(
      [...seed.completedTasks].map(([day, ids]) => [day, new Set(ids)]),
    );
  }

  /** Outcomes recorded on a day, in the order they were recorded. */
  outcomesOn(day: string): BlockOutcome[] {
    return [...(this.outcomes.get(day) ?? [])];
  }

  /** Records an outcome on a day, replacing the one of the same block. */
  recordOutcome(day: string, outcome: BlockOutcome): void {
    const others = this.withoutOutcome(day, outcome.routineId, outcome.blockId);
    this.outcomes.set(day, [...others, outcome]);
  }

  /** Takes back a block's outcome on a day. */
  removeOutcome(day: string, routineId: string, blockId: string): void {
    this.outcomes.set(day, this.withoutOutcome(day, routineId, blockId));
  }

  /** Ids of the tasks done on a day. */
  completedTasksOn(day: string): string[] {
    return [...(this.completedTasks.get(day) ?? [])];
  }

  /** Marks or unmarks a task as done on a day. */
  setTaskDone(taskId: string, day: string, isDone: boolean): void {
    const done = new Set(this.completedTasks.get(day));
    if (isDone) done.add(taskId);
    else done.delete(taskId);
    this.completedTasks.set(day, done);
  }

  /** A goal with its progress in the period around a day. */
  withProgress(goal: Goal, day: string): Goal {
    if (goal.type === 'objective') {
      return { ...goal, done: goal.achievedOn === undefined ? 0 : goal.target };
    }
    return { ...goal, done: completedInPeriod(goal, day, this.routines, this.outcomes) };
  }

  private withoutOutcome(day: string, routineId: string, blockId: string): BlockOutcome[] {
    return this.outcomesOn(day).filter(
      (item) => item.routineId !== routineId || item.blockId !== blockId,
    );
  }
}
