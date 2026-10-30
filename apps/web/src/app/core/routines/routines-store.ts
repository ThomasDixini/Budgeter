import { ErrorHandler, Injectable, WritableSignal, computed, inject, signal } from '@angular/core';
import { Clock } from '../calendar/clock';
import { isoDate } from '../calendar/date-label';
import { IdGenerator } from '../ids/id-generator';
import { CategoriesGateway } from './categories-gateway';
import { Category } from './category';
import { Goal, GoalChanges } from './goal';
import { GoalsGateway } from './goals-gateway';
import { Routine, blockMinutesWithin, weekdaysLabel, weeklyMinutesByCategory } from './routine';
import { RoutinesGateway } from './routines-gateway';

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
 * Categories, goals and routines of the Routines & Goals module, loaded from and saved through
 * their gateways (tasks live in `TasksStore`). Mutations apply locally first and roll back if
 * the gateway rejects them.
 */
@Injectable({ providedIn: 'root' })
export class RoutinesStore {
  private readonly categoriesGateway = inject(CategoriesGateway);
  private readonly goalsGateway = inject(GoalsGateway);
  private readonly routinesGateway = inject(RoutinesGateway);
  private readonly ids = inject(IdGenerator);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly clock = inject(Clock);
  private readonly categoryList = signal<readonly Category[]>([]);
  private readonly routineList = signal<readonly Routine[]>([]);
  private readonly goalList = signal<readonly Goal[]>([]);
  private readonly categoriesLoaded = signal(false);
  private readonly goalsLoaded = signal(false);
  private readonly routinesLoaded = signal(false);

  readonly categories = this.categoryList.asReadonly();
  readonly routines = this.routineList.asReadonly();
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
    this.goalsGateway.list(this.today()).subscribe({
      next: (goals) => this.loaded(this.goalList, this.goalsLoaded, goals),
      error: (error: unknown) => this.errorHandler.handleError(error),
    });
    this.routinesGateway.list().subscribe({
      next: (routines) => this.loaded(this.routineList, this.routinesLoaded, routines),
      error: (error: unknown) => this.errorHandler.handleError(error),
    });
  }

  /**
   * Marks an objective achieved today, or takes the mark back; the card shows it right away and goes
   * back if the gateway rejects it. Frequency goals are not marked: they count completed blocks.
   * @example store.setAchieved('g2', true)
   */
  setAchieved(goalId: string, isAchieved: boolean): void {
    const previous = this.goalList().find((goal) => goal.id === goalId);
    if (previous?.type !== 'objective') return;
    const today = this.today();
    replaceById(this.goalList, withAchievement(previous, isAchieved ? today : undefined));
    this.goalsGateway.setAchievement(goalId, today, isAchieved).subscribe({
      next: (saved) => replaceById(this.goalList, saved),
      error: (error: unknown) => this.rejected(error, () => replaceById(this.goalList, previous)),
    });
  }

  /**
   * Edits a goal (not its type or category); the card shows the change right away.
   * @example store.updateGoal('g1', { title: 'Study C# 4x', period: 'weekly', target: 4 })
   */
  updateGoal(goalId: string, changes: GoalChanges): void {
    const previous = this.goalList().find((goal) => goal.id === goalId);
    if (previous === undefined) return;
    replaceById(this.goalList, { ...previous, ...changes });
    this.goalsGateway.update(goalId, changes, this.today()).subscribe({
      next: (saved) => replaceById(this.goalList, saved),
      error: (error: unknown) => this.rejected(error, () => replaceById(this.goalList, previous)),
    });
  }

  /**
   * Deletes a goal and its progress; puts it back in place if the gateway rejects it.
   * @example store.deleteGoal('g1')
   */
  deleteGoal(goalId: string): void {
    const before = this.goalList();
    removeById(this.goalList, goalId);
    this.goalsGateway.delete(goalId).subscribe({
      error: (error: unknown) => this.rejected(error, () => this.goalList.set(before)),
    });
  }

  /**
   * Reloads every goal's progress, for after a block was completed, skipped or taken back.
   * @example store.refreshGoals()
   */
  refreshGoals(): void {
    this.goalsGateway.list(this.today()).subscribe({
      next: (fresh) => this.goalList.update((current) => withFreshProgress(current, fresh)),
      error: (error: unknown) => this.errorHandler.handleError(error),
    });
  }

  /**
   * Adds a goal with no progress yet.
   * @example store.addGoal({ categoryId: 'study', title: 'Read docs', type: 'frequency', period: 'weekly', target: 3 })
   */
  addGoal(draft: GoalDraft): Goal {
    const goal: Goal = { ...draft, id: this.ids.next(), done: 0 };
    this.goalList.update((goals) => [...goals, goal]);
    this.goalsGateway.create(goal, this.today()).subscribe({
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
   * Renames and recolors a category; the page shows it right away and goes back if it is rejected.
   * @example store.updateCategory('languages', 'Spanish', '#7DD3FC')
   */
  updateCategory(categoryId: string, name: string, color: string): void {
    const previous = this.categoryList().find((category) => category.id === categoryId);
    if (previous === undefined) return;
    const category: Category = { id: categoryId, name, color };
    replaceById(this.categoryList, category);
    this.categoriesGateway.update(category).subscribe({
      next: (saved) => replaceById(this.categoryList, saved),
      error: (error: unknown) =>
        this.rejected(error, () => replaceById(this.categoryList, previous)),
    });
  }

  /**
   * Deletes a category with its goals; routine blocks that used it stay, without a category (the API
   * does the same). Everything comes back if the gateway rejects it.
   * @example store.deleteCategory('languages')
   */
  deleteCategory(categoryId: string): void {
    const before = {
      categories: this.categoryList(),
      goals: this.goalList(),
      routines: this.routineList(),
    };
    this.categoryList.update((categories) => categories.filter((c) => c.id !== categoryId));
    this.goalList.update((goals) => goals.filter((goal) => goal.categoryId !== categoryId));
    this.routineList.update((routines) => routines.map((r) => withoutCategory(r, categoryId)));
    this.categoriesGateway.delete(categoryId).subscribe({
      error: (error: unknown) =>
        this.rejected(error, () => {
          this.categoryList.set(before.categories);
          this.goalList.set(before.goals);
          this.routineList.set(before.routines);
        }),
    });
  }

  /**
   * Saves a routine: replaces the stored one with the same id, or adds it when it is new.
   * Resolves to whether the gateway accepted it, so the editor knows when its draft is safe to drop.
   * @example const saved = await store.saveRoutine({ ...weekdays, end: '18:00' })
   */
  saveRoutine(routine: Routine): Promise<boolean> {
    const restore = this.applyRoutine(routine);
    return new Promise((resolve) => {
      this.routinesGateway.save(routine).subscribe({
        next: (saved) => {
          replaceById(this.routineList, saved);
          resolve(true);
        },
        error: (error: unknown) => {
          this.rejected(error, restore);
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

  /**
   * The local day goals are read for; their periods are the ones around it. Read on every call, not
   * once, so a page left open past midnight (or past Sunday) moves on to the new period.
   */
  private today(): string {
    return isoDate(this.clock.now());
  }

  private loaded<TRecord>(
    list: WritableSignal<readonly TRecord[]>,
    flag: WritableSignal<boolean>,
    records: readonly TRecord[],
  ): void {
    list.set(records);
    flag.set(true);
  }

  /**
   * Removes a routine right away and deletes it; puts it back in place if the gateway rejects it.
   * Resolves to whether the deletion went through.
   * @example const deleted = await store.deleteRoutine('weekend')
   */
  deleteRoutine(routineId: string): Promise<boolean> {
    const before = this.routineList();
    removeById(this.routineList, routineId);
    return new Promise((resolve) => {
      this.routinesGateway.delete(routineId).subscribe({
        next: () => resolve(true),
        error: (error: unknown) => {
          this.rejected(error, () => this.routineList.set(before));
          resolve(false);
        },
      });
    });
  }

  /** Shows the routine right away and returns how to undo that if the gateway rejects it. */
  private applyRoutine(routine: Routine): () => void {
    const previous = this.routineList().find((current) => current.id === routine.id);
    if (previous === undefined) {
      this.routineList.update((routines) => [...routines, routine]);
      return () => removeById(this.routineList, routine.id);
    }
    replaceById(this.routineList, routine);
    return () => replaceById(this.routineList, previous);
  }

  private rejected(error: unknown, rollback: () => void): void {
    rollback();
    this.errorHandler.handleError(error);
  }
}

/**
 * The local goals with the progress the API just reported. Goals are matched by id and nothing is
 * added or dropped, so a goal still being created or deleted here is not undone by a slow answer.
 */
function withFreshProgress(current: readonly Goal[], fresh: readonly Goal[]): Goal[] {
  const byId = new Map(fresh.map((goal) => [goal.id, goal]));
  return current.map((goal) => byId.get(goal.id) ?? goal);
}

function withoutCategory(routine: Routine, categoryId: string): Routine {
  if (!routine.blocks.some((block) => block.categoryId === categoryId)) return routine;
  const blocks = routine.blocks.map((block) =>
    block.categoryId === categoryId ? { ...block, categoryId: undefined } : block,
  );
  return { ...routine, blocks };
}

/** An objective as it reads once marked achieved on `isoDay`, or pending when it is undefined. */
function withAchievement(goal: Goal, isoDay: string | undefined): Goal {
  if (isoDay === undefined) return { ...goal, achievedOn: undefined, done: 0 };
  return { ...goal, achievedOn: isoDay, done: goal.target };
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
