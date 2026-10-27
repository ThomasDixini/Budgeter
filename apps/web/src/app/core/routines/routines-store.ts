import { Injectable, signal } from '@angular/core';
import { Category } from './category';
import { Goal } from './goal';
import { Routine, blockMinutesWithin, weekdaysLabel, weeklyMinutesByCategory } from './routine';
import { SAMPLE_CATEGORIES, SAMPLE_GOALS, SAMPLE_ROUTINES, SAMPLE_TASKS } from './sample-routines';
import { Task } from './task';

/** A routine block seen from its category: which block and when it happens. */
export interface CategoryBlock {
  readonly name: string;
  readonly when: string;
}

export type GoalDraft = Omit<Goal, 'id' | 'done'>;

/**
 * In-memory state of the Routines & Goals module, seeded with sample content.
 * Pages depend on this class only, so a persisted adapter can replace it later.
 */
@Injectable({ providedIn: 'root' })
export class RoutinesStore {
  private nextId = 1;
  private readonly categoryList = signal<readonly Category[]>(SAMPLE_CATEGORIES);
  private readonly routineList = signal<readonly Routine[]>(SAMPLE_ROUTINES);
  private readonly taskList = signal<readonly Task[]>(SAMPLE_TASKS);
  private readonly goalList = signal<readonly Goal[]>(SAMPLE_GOALS);

  readonly categories = this.categoryList.asReadonly();
  readonly routines = this.routineList.asReadonly();
  readonly tasks = this.taskList.asReadonly();
  readonly goals = this.goalList.asReadonly();

  /**
   * Flips a task between done and pending.
   * @example store.toggleTask('t3')
   */
  toggleTask(taskId: string): void {
    this.taskList.update((tasks) =>
      tasks.map((task) => (task.id === taskId ? { ...task, done: !task.done } : task)),
    );
  }

  /**
   * Logs one more repetition or unit of progress, stopping at the target.
   * @example store.incrementGoal('g1')
   */
  incrementGoal(goalId: string): void {
    this.goalList.update((goals) =>
      goals.map((goal) =>
        goal.id === goalId ? { ...goal, done: Math.min(goal.target, goal.done + 1) } : goal,
      ),
    );
  }

  /**
   * Adds a goal with no progress yet.
   * @example store.addGoal({ categoryId: 'study', title: 'Read docs', type: 'frequency', period: 'weekly', target: 3 })
   */
  addGoal(draft: GoalDraft): Goal {
    const goal: Goal = { ...draft, id: this.createId('goal'), done: 0 };
    this.goalList.update((goals) => [...goals, goal]);
    return goal;
  }

  /**
   * Creates a category and returns it so the caller can open it.
   * @example store.addCategory('Languages', '#86EFAC').id
   */
  addCategory(name: string, color: string): Category {
    const category: Category = { id: this.createId('category'), name, color };
    this.categoryList.update((categories) => [...categories, category]);
    return category;
  }

  /**
   * Replaces a routine with its edited version.
   * @example store.saveRoutine({ ...weekdays, end: '18:00' })
   */
  saveRoutine(routine: Routine): void {
    this.routineList.update((routines) =>
      routines.map((current) => (current.id === routine.id ? routine : current)),
    );
  }

  /**
   * Minutes per week the routines dedicate to a category.
   * @example store.weeklyMinutes('study') // 450
   */
  weeklyMinutes(categoryId: string): number {
    return this.routineList().reduce(
      (sum, routine) => sum + (weeklyMinutesByCategory(routine).get(categoryId) ?? 0),
      0,
    );
  }

  /**
   * Routine blocks that belong to a category, with when they happen.
   * @example store.categoryBlocks('study') // [{ name: 'C# study', when: 'Mon–Fri · 13:30–15:00' }]
   */
  categoryBlocks(categoryId: string): CategoryBlock[] {
    return this.routineList().flatMap((routine) =>
      routine.blocks
        .filter((block) => block.categoryId === categoryId)
        .filter((block) => blockMinutesWithin(block, routine) > 0)
        .map((block) => ({
          name: block.name,
          when: `${weekdaysLabel(routine.days)} · ${block.start}–${block.end}`,
        })),
    );
  }

  private createId(prefix: string): string {
    return `${prefix}-${this.nextId++}`;
  }
}
