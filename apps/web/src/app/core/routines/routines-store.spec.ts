import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NEVER, Observable, of } from 'rxjs';
import { Clock } from '../calendar/clock';
import { FixedClock } from '../calendar/fixed-clock';
import { Category } from './category';
import { Goal } from './goal';
import {
  FakeCategoriesGateway,
  FakeGoalsGateway,
  FakeRoutinesGateway,
  provideFakeRoutinesGateways,
} from './fake-routines-gateways';
import { RoutinesStore } from './routines-store';

/** Records reported errors instead of logging them. */
class RecordingErrorHandler extends ErrorHandler {
  readonly errors: unknown[] = [];

  override handleError(error: unknown): void {
    this.errors.push(error);
  }
}

/** A clock a test can move, like a page left open while the day changes. */
class MovableClock extends Clock {
  constructor(public moment: Date) {
    super();
  }

  override now(): Date {
    return new Date(this.moment);
  }
}

/** Creating a goal never answers, as while the API is slow. */
class SlowCreateGoalsGateway extends FakeGoalsGateway {
  override create(): Observable<Goal> {
    return NEVER;
  }
}

/** Answers creations with the normalized category the API would store. */
class NormalizingCategoriesGateway extends FakeCategoriesGateway {
  override create(category: Category): Observable<Category> {
    return of({ ...category, name: category.name.trim(), color: category.color.toUpperCase() });
  }
}

interface StoreSetup {
  readonly store: RoutinesStore;
  readonly categories: FakeCategoriesGateway;
  readonly goals: FakeGoalsGateway;
  readonly routines: FakeRoutinesGateway;
  readonly errors: RecordingErrorHandler;
}

function createStore(
  categories = new FakeCategoriesGateway(),
  goals = new FakeGoalsGateway(),
  routines = new FakeRoutinesGateway(),
  clock: Clock = new FixedClock(new Date(2026, 9, 26, 9, 0)),
): StoreSetup {
  const errors = new RecordingErrorHandler();
  TestBed.configureTestingModule({
    providers: [
      ...provideFakeRoutinesGateways(categories, goals, routines),
      { provide: Clock, useValue: clock },
      { provide: ErrorHandler, useValue: errors },
    ],
  });
  return { store: TestBed.inject(RoutinesStore), categories, goals, routines, errors };
}

describe('RoutinesStore', () => {
  it('loads categories and goals from the gateways', () => {
    const { store } = createStore();

    expect(store.categories().map((category) => category.id)).toEqual([
      'study',
      'networking',
      'reading',
      'exercise',
    ]);
    expect(store.goals()).toHaveLength(7);
    expect(store.isLoaded()).toBe(true);
  });

  it('reports a failed load and stays not loaded', () => {
    const categories = new FakeCategoriesGateway();
    categories.failure = new Error('offline');

    const { store, errors } = createStore(categories);

    expect(store.isLoaded()).toBe(false);
    expect(errors.errors).toEqual([categories.failure]);
  });

  it('increments a goal without passing its target', () => {
    const { store } = createStore();

    store.incrementGoal('g3');

    expect(store.goals().find((goal) => goal.id === 'g3')?.done).toBe(1);
  });

  it('ignores progress on an unknown goal', () => {
    const { store, errors } = createStore();

    store.incrementGoal('missing');

    expect(errors.errors).toEqual([]);
  });

  it('restores the progress when logging it fails', () => {
    const { store, goals, errors } = createStore();
    goals.failure = new Error('offline');

    store.incrementGoal('g1');

    expect(store.goals().find((goal) => goal.id === 'g1')?.done).toBe(3);
    expect(errors.errors).toEqual([goals.failure]);
  });

  it('loads the goals for the period around today', () => {
    const { goals } = createStore();

    expect(goals.listedDays).toEqual(['2026-10-26']);
  });

  it('logs +1 as an entry with its own id, for today', () => {
    const { store, goals } = createStore();

    store.incrementGoal('g1');

    expect(goals.entries).toEqual([{ eventId: 'id-1', isoDay: '2026-10-26', amount: 1 }]);
    expect(store.goals().find((goal) => goal.id === 'g1')?.done).toBe(4);
  });

  it('takes one back with a -1 entry', () => {
    const { store, goals } = createStore();

    store.decrementGoal('g1');

    expect(goals.entries[0].amount).toBe(-1);
    expect(store.goals().find((goal) => goal.id === 'g1')?.done).toBe(2);
  });

  it('never shows progress below zero when taking back', () => {
    const { store } = createStore();

    store.decrementGoal('g5');

    expect(store.goals().find((goal) => goal.id === 'g5')?.done).toBe(0);
  });

  it('restores the progress when taking one back fails', () => {
    const { store, goals, errors } = createStore();
    goals.failure = new Error('offline');

    store.decrementGoal('g1');

    expect(store.goals().find((goal) => goal.id === 'g1')?.done).toBe(3);
    expect(errors.errors).toEqual([goals.failure]);
  });

  it('edits a goal and keeps its type and category', () => {
    const { store, goals } = createStore();
    const changes = {
      title: 'Study C# 2x',
      period: 'monthly',
      target: 2,
      tracking: 'blocks',
    } as const;

    store.updateGoal('g1', changes);

    expect(store.goals().find((goal) => goal.id === 'g1')).toMatchObject({
      ...changes,
      type: 'frequency',
      categoryId: 'study',
      done: 2,
    });
    expect(goals.updated).toEqual([{ goalId: 'g1', changes }]);
  });

  it('puts the goal back as it was when editing it fails', () => {
    const { store, goals } = createStore();
    goals.failure = new Error('offline');

    store.updateGoal('g1', { title: 'Renamed', period: 'weekly', target: 5, tracking: 'manual' });

    expect(store.goals().find((goal) => goal.id === 'g1')?.title).toBe('Study C# 5x a week');
  });

  it('deletes a goal and puts it back in place when that fails', () => {
    const { store, goals } = createStore();

    store.deleteGoal('g3');
    expect(store.goals().map((goal) => goal.id)).not.toContain('g3');
    goals.failure = new Error('offline');
    store.deleteGoal('g4');

    expect(store.goals().map((goal) => goal.id)).toContain('g4');
    expect(goals.deleted).toEqual(['g3', 'g4']);
  });

  it('follows the day when a page is left open: +1 and reloads use the new day', () => {
    const sunday = new MovableClock(new Date(2026, 10, 1, 23, 50));
    const { store, goals } = createStore(undefined, undefined, undefined, sunday);
    store.incrementGoal('g1');

    sunday.moment = new Date(2026, 10, 2, 0, 10);
    store.incrementGoal('g1');
    store.refreshGoals();

    expect(goals.entries.map((entry) => entry.isoDay)).toEqual(['2026-11-01', '2026-11-02']);
    expect(goals.listedDays).toEqual(['2026-11-01', '2026-11-02']);
  });

  it('keeps a goal that is still being created when the reload answers without it', () => {
    const { store } = createStore(undefined, new SlowCreateGoalsGateway());
    const goal = store.addGoal({
      categoryId: 'study',
      title: 'Read the docs',
      type: 'frequency',
      period: 'weekly',
      target: 2,
      tracking: 'manual',
    });

    store.refreshGoals();

    expect(store.goals().map((current) => current.id)).toContain(goal.id);
  });

  it('updates the progress of the goals it already has from a reload', () => {
    const { store, goals } = createStore();
    goals.logProgress('g1', { eventId: 'outside', isoDay: '2026-10-26', amount: 1 }).subscribe();

    store.refreshGoals();

    expect(store.goals().find((goal) => goal.id === 'g1')?.done).toBe(4);
  });

  it('reloads the goals when asked, for after a block or a task counted', () => {
    const { store, goals } = createStore();

    store.refreshGoals();

    expect(goals.listedDays).toEqual(['2026-10-26', '2026-10-26']);
    expect(store.goals()).toHaveLength(7);
  });

  it('adds a goal with no progress and saves it', () => {
    const { store, goals } = createStore();

    const goal = store.addGoal({
      categoryId: 'study',
      title: 'Read the docs',
      type: 'frequency',
      period: 'weekly',
      target: 2,
      tracking: 'manual',
    });

    expect(store.goals().at(-1)).toEqual({ ...goal, done: 0 });
    expect(goals.saved).toEqual([goal]);
  });

  it('drops a goal the gateway rejects', () => {
    const { store, goals } = createStore();
    goals.failure = new Error('offline');

    store.addGoal({
      categoryId: 'study',
      title: 'X',
      type: 'frequency',
      period: 'daily',
      target: 1,
      tracking: 'manual',
    });

    expect(store.goals()).toHaveLength(7);
  });

  it('adds a category with a fresh id and saves it', () => {
    const { store, categories } = createStore();

    const category = store.addCategory('Languages', '#86EFAC');

    expect(category.id).toBe('id-1');
    expect(store.categories().at(-1)).toEqual(category);
    expect(categories.saved).toEqual([category]);
  });

  it('keeps the version of the category the gateway stored', () => {
    const { store } = createStore(new NormalizingCategoriesGateway());

    store.addCategory(' Languages ', '#86efac');

    expect(store.categories().at(-1)).toMatchObject({ name: 'Languages', color: '#86EFAC' });
  });

  it('drops a category the gateway rejects', () => {
    const { store, categories, errors } = createStore();
    categories.failure = new Error('offline');

    store.addCategory('Languages', '#86EFAC');

    expect(store.categories()).toHaveLength(4);
    expect(errors.errors).toEqual([categories.failure]);
  });

  it('loads routines from the gateway', () => {
    const { store } = createStore();

    expect(store.routines().map((routine) => routine.id)).toEqual(['weekdays', 'weekend']);
  });

  it('stays not loaded when routines fail to load', () => {
    const routines = new FakeRoutinesGateway();
    routines.failure = new Error('offline');

    const { store, errors } = createStore(undefined, undefined, routines);

    expect(store.isLoaded()).toBe(false);
    expect(errors.errors).toEqual([routines.failure]);
  });

  it('saves an edited routine through the gateway', async () => {
    const { store, routines } = createStore();
    const edited = { ...store.routines()[0], end: '18:00' };

    const isSaved = await store.saveRoutine(edited);

    expect(isSaved).toBe(true);
    expect(store.routines()[0].end).toBe('18:00');
    expect(routines.saved).toEqual([edited]);
  });

  it('restores the routine when the gateway rejects it', async () => {
    const { store, routines, errors } = createStore();
    routines.failure = new Error('offline');

    const isSaved = await store.saveRoutine({ ...store.routines()[0], end: '18:00' });

    expect(isSaved).toBe(false);
    expect(store.routines()[0].end).toBe('17:00');
    expect(errors.errors).toEqual([routines.failure]);
  });

  it('adds a new routine after the loaded ones and saves it', async () => {
    const { store, routines } = createStore();
    const night = { ...store.routines()[0], id: 'night', name: 'Night shift' };

    const isSaved = await store.saveRoutine(night);

    expect(isSaved).toBe(true);
    expect(store.routines().map((routine) => routine.id)).toEqual(['weekdays', 'weekend', 'night']);
    expect(routines.saved).toEqual([night]);
  });

  it('deletes a routine through the gateway', async () => {
    const { store, routines } = createStore();

    const isDeleted = await store.deleteRoutine('weekdays');

    expect(isDeleted).toBe(true);
    expect(store.routines().map((routine) => routine.id)).toEqual(['weekend']);
    expect(routines.deleted).toEqual(['weekdays']);
  });

  it('puts a routine back in its place when deleting it fails', async () => {
    const { store, routines, errors } = createStore();
    routines.failure = new Error('offline');

    const isDeleted = await store.deleteRoutine('weekdays');

    expect(isDeleted).toBe(false);
    expect(store.routines().map((routine) => routine.id)).toEqual(['weekdays', 'weekend']);
    expect(errors.errors).toEqual([routines.failure]);
  });

  it('drops a new routine the gateway rejects', async () => {
    const { store, routines } = createStore();
    routines.failure = new Error('offline');

    await store.saveRoutine({ ...store.routines()[0], id: 'night' });

    expect(store.routines().map((routine) => routine.id)).toEqual(['weekdays', 'weekend']);
  });

  it('sums weekly minutes of a category across routines', () => {
    expect(createStore().store.weeklyMinutes('networking')).toBe(600);
  });

  it('lists the routine blocks of a category', () => {
    expect(createStore().store.categoryBlocks('study')).toEqual([
      { name: 'C# study', when: 'Mon–Fri · 13:30–15:00' },
    ]);
  });
});
