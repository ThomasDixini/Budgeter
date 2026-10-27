import { ErrorHandler, Injectable, WritableSignal, computed, inject, signal } from '@angular/core';
import { IdGenerator } from '../ids/id-generator';
import { CategoriesGateway } from './categories-gateway';
import { Category } from './category';
import { Goal } from './goal';
import { GoalsGateway } from './goals-gateway';
import { Routine, blockMinutesWithin, weekdaysLabel, weeklyMinutesByCategory } from './routine';
import { RoutinesGateway } from './routines-gateway';
import { SAMPLE_TASKS } from './sample-routines';
import { Task } from './task';

/** A routine block seen from its category: which block and when it happens. */
export interface CategoryBlock {
  readonly name: string;
  readonly when: string;
}

export type GoalDraft = Omit<Goal, 'id' | 'done'>;

interface Identified {
  readonly id: string;
}

/**
 * State of the Routines & Goals module. Categories, goals and routines are loaded from and saved
 * through their gateways; tasks are still sample content kept in memory.
 * Mutations apply locally first and roll back if the gateway rejects them.
 */
@Injectable({ providedIn: 'root' })
export class RoutinesStore {
  private readonly categoriesGateway = inject(CategoriesGateway);
  private readonly goalsGateway = inject(GoalsGateway);
  private readonly routinesGateway = inject(RoutinesGateway);
  private readonly ids = inject(IdGenerator);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly categoryList = signal<readonly Category[]>([]);
  private readonly routineList = signal<readonly Routine[]>([]);
  private readonly taskList = signal<readonly Task[]>(SAMPLE_TASKS);
  private readonly goalList = signal<readonly Goal[]>([]);
  private readonly categoriesLoaded = signal(false);
  private readonly goalsLoaded = signal(false);
  private readonly routinesLoaded = signal(false);

  readonly categories = this.categoryList.asReadonly();
  readonly routines = this.routineList.asReadonly();
  readonly tasks = this.taskList.asReadonly();
  readonly goals = this.goalList.asReadonly();
  /** Whether everything arrived, so "not found" or "empty" can be told apart from "still loading". */
  readonly isLoaded = computed(
    () => this.categoriesLoaded() && this.goalsLoaded() && this.routinesLoaded(),
  );

  constructor() {
    this.categoriesGateway.list().subscribe({
      next: (categories) => this.loaded(this.categoryList, this.categoriesLoaded, categories),
      error: (error: unknown) => this.errorHandler.handleError(error),
    });
    this.goalsGateway.list().subscribe({
      next: (goals) => this.loaded(this.goalList, this.goalsLoaded, goals),
      error: (error: unknown) => this.errorHandler.handleError(error),
    });
    this.routinesGateway.list().subscribe({
      next: (routines) => this.loaded(this.routineList, this.routinesLoaded, routines),
      error: (error: unknown) => this.errorHandler.handleError(error),
    });
  }

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
    const previous = this.goalList().find((goal) => goal.id === goalId);
    if (previous === undefined) return;
    replaceById(this.goalList, { ...previous, done: Math.min(previous.target, previous.done + 1) });
    this.goalsGateway.logProgress(goalId).subscribe({
      next: (saved) => replaceById(this.goalList, saved),
      error: (error: unknown) => this.rejected(error, () => replaceById(this.goalList, previous)),
    });
  }

  /**
   * Adds a goal with no progress yet.
   * @example store.addGoal({ categoryId: 'study', title: 'Read docs', type: 'frequency', period: 'weekly', target: 3 })
   */
  addGoal(draft: GoalDraft): Goal {
    const goal: Goal = { ...draft, id: this.ids.next(), done: 0 };
    this.goalList.update((goals) => [...goals, goal]);
    this.goalsGateway.create(goal).subscribe({
      next: (saved) => replaceById(this.goalList, saved),
      error: (error: unknown) => this.rejected(error, () => removeById(this.goalList, goal.id)),
    });
    return goal;
  }

  /**
   * Creates a category and returns it right away so the caller can open it.
   * @example store.addCategory('Languages', '#86EFAC').id
   */
  addCategory(name: string, color: string): Category {
    const category: Category = { id: this.ids.next(), name, color };
    this.categoryList.update((categories) => [...categories, category]);
    this.categoriesGateway.create(category).subscribe({
      next: (saved) => replaceById(this.categoryList, saved),
      error: (error: unknown) =>
        this.rejected(error, () => removeById(this.categoryList, category.id)),
    });
    return category;
  }

  /**
   * Replaces a routine with its edited version and saves it. Resolves to whether the gateway
   * accepted it, so the editor knows when its draft is safe to drop.
   * @example const saved = await store.saveRoutine({ ...weekdays, end: '18:00' })
   */
  saveRoutine(routine: Routine): Promise<boolean> {
    const previous = this.routineList().find((current) => current.id === routine.id);
    if (previous === undefined) {
      const error = new RangeError(`Expected a known routine id, received "${routine.id}"`);
      return Promise.reject(error);
    }
    replaceById(this.routineList, routine);
    return new Promise((resolve) => {
      this.routinesGateway.save(routine).subscribe({
        next: (saved) => {
          replaceById(this.routineList, saved);
          resolve(true);
        },
        error: (error: unknown) => {
          this.rejected(error, () => replaceById(this.routineList, previous));
          resolve(false);
        },
      });
    });
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

  private loaded<TRecord>(
    list: WritableSignal<readonly TRecord[]>,
    flag: WritableSignal<boolean>,
    records: readonly TRecord[],
  ): void {
    list.set(records);
    flag.set(true);
  }

  private rejected(error: unknown, rollback: () => void): void {
    rollback();
    this.errorHandler.handleError(error);
  }
}

function replaceById<TRecord extends Identified>(
  list: WritableSignal<readonly TRecord[]>,
  record: TRecord,
): void {
  list.update((records) => records.map((current) => (current.id === record.id ? record : current)));
}

function removeById<TRecord extends Identified>(
  list: WritableSignal<readonly TRecord[]>,
  id: string,
): void {
  list.update((records) => records.filter((current) => current.id !== id));
}
