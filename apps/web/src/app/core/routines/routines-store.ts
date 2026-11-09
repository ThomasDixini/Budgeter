import { ErrorHandler, Injectable, WritableSignal, computed, inject, signal } from '@angular/core';
import { Observer } from 'rxjs';
import { Clock } from '../calendar/clock';
import { isoDate } from '../calendar/date-label';
import { IdGenerator } from '../ids/id-generator';
import { CategoriesGateway } from './categories-gateway';
import { Category } from './category';
import { CategoryCreations } from './category-creations';
import { Goal, GoalChanges } from './goal';
import { GoalsGateway } from './goals-gateway';
import {
  Positioned,
  positionOf,
  positionsOf,
  restoredAllAt,
  restoredAt,
  sameId,
} from '../lists/list-positions';
import { Routine, blockMinutesWithin, weekdaysLabel, weeklyMinutesByCategory } from './routine';
import { RoutineRotationStore } from './routine-rotation-store';
import { weekShare } from './routine-rotation';
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

/** What deleting a category took off the lists, so a rejected deletion can put each piece back. */
interface CategoryRemoval {
  readonly categoryId: string;
  readonly category: Positioned<Category> | undefined;
  readonly goals: readonly Positioned<Goal>[];
  /** Ids of the blocks that lost the category, by routine id. */
  readonly detachedBlocks: ReadonlyMap<string, readonly string[]>;
}

/**
 * Categories, goals and routines of the Routines & Goals module, loaded from and saved through
 * their gateways (tasks live in `TasksStore`). Mutations apply locally first and roll back if
 * the gateway rejects them. A rollback only undoes its own change, so whatever was added, edited or
 * removed while the request was in flight stays; and a slow answer never overwrites a newer edit.
 */
@Injectable({ providedIn: 'root' })
export class RoutinesStore {
  private readonly categoriesGateway = inject(CategoriesGateway);
  private readonly goalsGateway = inject(GoalsGateway);
  private readonly routinesGateway = inject(RoutinesGateway);
  private readonly ids = inject(IdGenerator);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly clock = inject(Clock);
  private readonly rotationStore = inject(RoutineRotationStore);
  private readonly categoryList = signal<readonly Category[]>([]);
  private readonly routineList = signal<readonly Routine[]>([]);
  private readonly goalList = signal<readonly Goal[]>([]);
  private readonly categoriesLoaded = signal(false);
  private readonly goalsLoaded = signal(false);
  private readonly routinesLoaded = signal(false);
  /** The local day the goals on screen were last read for. */
  private goalsDay = this.today();
  private readonly categoryCreations = inject(CategoryCreations);

  readonly categories = this.categoryList.asReadonly();
  readonly routines = this.routineList.asReadonly();
  readonly goals = this.goalList.asReadonly();
  /** Whether everything arrived, so "not found" or "empty" can be told apart from "still loading". */
  readonly isLoaded = computed(
    () => this.categoriesLoaded() && this.goalsLoaded() && this.routinesLoaded(),
  );
  private readonly loadFailed = signal(false);
  /** Whether loading failed with nothing on its way, so a page can offer to try again. */
  readonly hasLoadFailed = this.loadFailed.asReadonly();

  constructor() {
    this.loadMissing();
  }

  /**
   * Loads again whatever did not arrive, after a failed load; what did arrive is kept.
   * @example store.reload()
   */
  reload(): void {
    this.loadFailed.set(false);
    this.loadMissing();
  }

  private loadMissing(): void {
    if (!this.categoriesLoaded()) {
      this.categoriesGateway
        .list()
        .subscribe(this.loadInto(this.categoryList, this.categoriesLoaded));
    }
    if (!this.goalsLoaded()) {
      this.goalsDay = this.today();
      this.goalsGateway
        .list(this.goalsDay)
        .subscribe(this.loadInto(this.goalList, this.goalsLoaded));
    }
    if (!this.routinesLoaded()) {
      this.routinesGateway.list().subscribe(this.loadInto(this.routineList, this.routinesLoaded));
    }
  }

  private loadInto<TRecord>(
    list: WritableSignal<readonly TRecord[]>,
    flag: WritableSignal<boolean>,
  ): Partial<Observer<readonly TRecord[]>> {
    return {
      next: (records) => this.loaded(list, flag, records),
      error: (error: unknown) => {
        this.loadFailed.set(true);
        this.errorHandler.handleError(error);
      },
    };
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
    const marked = withAchievement(previous, isAchieved ? today : undefined);
    replaceIfShown(this.goalList, previous, marked);
    this.goalsGateway.setAchievement(goalId, today, isAchieved).subscribe({
      next: (saved) => replaceIfShown(this.goalList, marked, saved),
      error: (error: unknown) =>
        this.rejected(error, () => replaceIfShown(this.goalList, marked, previous)),
    });
  }

  /**
   * Edits a goal (not its type or category); the card shows the change right away.
   * @example store.updateGoal('g1', { title: 'Study C# 4x', period: 'weekly', target: 4 })
   */
  updateGoal(goalId: string, changes: GoalChanges): void {
    const previous = this.goalList().find((goal) => goal.id === goalId);
    if (previous === undefined) return;
    const edited: Goal = { ...previous, ...changes };
    replaceIfShown(this.goalList, previous, edited);
    this.goalsGateway.update(goalId, changes, this.today()).subscribe({
      next: (saved) => replaceIfShown(this.goalList, edited, saved),
      error: (error: unknown) =>
        this.rejected(error, () => replaceIfShown(this.goalList, edited, previous)),
    });
  }

  /**
   * Deletes a goal and its progress; puts it back in place if the gateway rejects it.
   * @example store.deleteGoal('g1')
   */
  deleteGoal(goalId: string): void {
    const removed = positionOf(this.goalList(), (goal) => goal.id === goalId);
    removeById(this.goalList, goalId);
    this.goalsGateway.delete(goalId).subscribe({
      error: (error: unknown) => this.rejected(error, () => putBack(this.goalList, removed)),
    });
  }

  /**
   * Reloads the goals when the clock moved to another day since they were read, e.g. on a page left
   * open past midnight (or past Sunday), so their progress is the one of the new period.
   * @example store.followClock()
   */
  followClock(): void {
    if (this.today() !== this.goalsDay) this.refreshGoals();
  }

  /**
   * Reloads every goal's progress, for after a block was completed, skipped or taken back.
   * @example store.refreshGoals()
   */
  refreshGoals(): void {
    this.goalsDay = this.today();
    this.goalsGateway.list(this.goalsDay).subscribe({
      next: (fresh) => this.goalList.update((current) => withFreshProgress(current, fresh)),
      error: (error: unknown) => this.errorHandler.handleError(error),
    });
  }

  /**
   * Adds a goal with no progress yet. A goal of a category still being created is sent once the
   * category is saved (the API rejects a goal of an unknown category), and dropped if saving it fails.
   * @example store.addGoal({ categoryId: 'study', title: 'Read docs', type: 'frequency', period: 'weekly', target: 3 })
   */
  addGoal(draft: GoalDraft): Goal {
    const goal: Goal = { ...draft, id: this.ids.next(), done: 0 };
    const today = this.today();
    this.goalList.update((goals) => [...goals, goal]);
    this.categoryCreations
      .whenSaved(
        [goal.categoryId],
        () => this.goalsGateway.create(goal, today),
        () => removeIfShown(this.goalList, goal),
      )
      .subscribe({
        next: (saved) => replaceIfShown(this.goalList, goal, saved),
        error: (error: unknown) => this.rejected(error, () => removeIfShown(this.goalList, goal)),
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
    this.categoryCreations.track(category.id, this.categoriesGateway.create(category)).subscribe({
      next: (saved) => replaceIfShown(this.categoryList, category, saved),
      error: (error: unknown) =>
        this.rejected(error, () => removeIfShown(this.categoryList, category)),
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
    replaceIfShown(this.categoryList, previous, category);
    this.categoriesGateway.update(category).subscribe({
      next: (saved) => replaceIfShown(this.categoryList, category, saved),
      error: (error: unknown) =>
        this.rejected(error, () => replaceIfShown(this.categoryList, category, previous)),
    });
  }

  /**
   * Deletes a category with its goals; routine blocks that used it stay, without a category (the API
   * does the same). Each piece comes back if the gateway rejects it. Resolves to whether the deletion
   * went through, so the caller can put back what it changed elsewhere (the tasks).
   * @example const deleted = await store.deleteCategory('languages')
   */
  deleteCategory(categoryId: string): Promise<boolean> {
    const removal = this.removeCategoryLocally(categoryId);
    return new Promise((resolve) => {
      this.categoriesGateway.delete(categoryId).subscribe({
        next: () => resolve(true),
        error: (error: unknown) => {
          this.rejected(error, () => this.restoreCategory(removal));
          resolve(false);
        },
      });
    });
  }

  /**
   * Saves a routine: replaces the stored one with the same id, or adds it when it is new. Blocks of a
   * category still being created are sent once it is saved. Resolves to whether the gateway accepted
   * it, so the editor knows when its draft is safe to drop.
   * @example const saved = await store.saveRoutine({ ...weekdays, end: '18:00' })
   */
  saveRoutine(routine: Routine): Promise<boolean> {
    const restore = this.applyRoutine(routine);
    const categoryIds = routine.blocks.map((block) => block.categoryId);
    return new Promise((resolve) => {
      const dropped = (): void => {
        restore();
        resolve(false);
      };
      const save = () => this.routinesGateway.save(routine);
      this.categoryCreations.whenSaved(categoryIds, save, dropped).subscribe({
        next: (saved) => {
          replaceIfShown(this.routineList, routine, saved);
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
   * Minutes per week the routines dedicate to a category; a routine of the rotation counts for the
   * share of weeks it applies in, so this is the average week of the cycle.
   * @example store.weeklyMinutes('study') // 450
   */
  weeklyMinutes(categoryId: string): number {
    const rotation = this.rotationStore.rotation();
    return this.routineList().reduce((sum, routine) => {
      const minutes = weeklyMinutesByCategory(routine).get(categoryId) ?? 0;
      return sum + minutes * weekShare(rotation, routine.id);
    }, 0);
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
    const removed = positionOf(this.routineList(), (routine) => routine.id === routineId);
    removeById(this.routineList, routineId);
    return new Promise((resolve) => {
      this.routinesGateway.delete(routineId).subscribe({
        next: () => resolve(true),
        error: (error: unknown) => {
          this.rejected(error, () => putBack(this.routineList, removed));
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
      return () => removeIfShown(this.routineList, routine);
    }
    replaceIfShown(this.routineList, previous, routine);
    return () => replaceIfShown(this.routineList, routine, previous);
  }

  /** Takes the category, its goals and its block links off the lists, remembering where each was. */
  private removeCategoryLocally(categoryId: string): CategoryRemoval {
    const removal: CategoryRemoval = {
      categoryId,
      category: positionOf(this.categoryList(), (category) => category.id === categoryId),
      goals: positionsOf(this.goalList(), (goal) => goal.categoryId === categoryId),
      detachedBlocks: blocksOfCategory(this.routineList(), categoryId),
    };
    this.categoryList.update((categories) => categories.filter((c) => c.id !== categoryId));
    this.goalList.update((goals) => goals.filter((goal) => goal.categoryId !== categoryId));
    this.routineList.update((routines) => routines.map((r) => withoutCategory(r, categoryId)));
    return removal;
  }

  private restoreCategory(removal: CategoryRemoval): void {
    putBack(this.categoryList, removal.category);
    this.goalList.update((goals) => restoredAllAt(goals, removal.goals, sameId));
    this.routineList.update((routines) => routines.map((r) => withCategoryBack(r, removal)));
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

/** Ids of the blocks that use the category, by routine id, for the routines that have any. */
function blocksOfCategory(routines: readonly Routine[], categoryId: string): Map<string, string[]> {
  const blocks = new Map<string, string[]>();
  for (const routine of routines) {
    const ids = routine.blocks.filter((block) => block.categoryId === categoryId).map((b) => b.id);
    if (ids.length > 0) blocks.set(routine.id, ids);
  }
  return blocks;
}

/** The routine with the category back on the blocks that lost it, unless one got another since. */
function withCategoryBack(routine: Routine, removal: CategoryRemoval): Routine {
  const blockIds = removal.detachedBlocks.get(routine.id);
  if (blockIds === undefined) return routine;
  const blocks = routine.blocks.map((block) =>
    blockIds.includes(block.id) && block.categoryId === undefined
      ? { ...block, categoryId: removal.categoryId }
      : block,
  );
  return { ...routine, blocks };
}

/** An objective as it reads once marked achieved on `isoDay`, or pending when it is undefined. */
function withAchievement(goal: Goal, isoDay: string | undefined): Goal {
  if (isoDay === undefined) return { ...goal, achievedOn: undefined, done: 0 };
  return { ...goal, achievedOn: isoDay, done: goal.target };
}

/**
 * Swaps `shown` for `next` only while `shown` is still the version on screen: once a newer edit has
 * replaced it, that edit wins and its own request answers for it.
 */
function replaceIfShown<TRecord>(
  list: WritableSignal<readonly TRecord[]>,
  shown: TRecord,
  next: TRecord,
): void {
  list.update((records) => records.map((current) => (current === shown ? next : current)));
}

/** Drops `shown` unless something replaced it since, such as an edit saved by its own request. */
function removeIfShown<TRecord>(list: WritableSignal<readonly TRecord[]>, shown: TRecord): void {
  list.update((records) => records.filter((current) => current !== shown));
}

function removeById<TRecord extends Identified>(
  list: WritableSignal<readonly TRecord[]>,
  id: string,
): void {
  list.update((records) => records.filter((current) => current.id !== id));
}

/** Puts a removed record back at its old index, unless one with its id is already there. */
function putBack<TRecord extends Identified>(
  list: WritableSignal<readonly TRecord[]>,
  removed: Positioned<TRecord> | undefined,
): void {
  if (removed === undefined) return;
  list.update((records) => restoredAt(records, removed, sameId));
}
