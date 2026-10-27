import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { Category } from './category';
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
): StoreSetup {
  const errors = new RecordingErrorHandler();
  TestBed.configureTestingModule({
    providers: [
      ...provideFakeRoutinesGateways(categories, goals, routines),
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

  it('toggles a task', () => {
    const { store } = createStore();

    store.toggleTask('t3');

    expect(store.tasks().find((task) => task.id === 't3')?.done).toBe(true);
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

  it('adds a goal with no progress and saves it', () => {
    const { store, goals } = createStore();

    const goal = store.addGoal({
      categoryId: 'study',
      title: 'Read the docs',
      type: 'frequency',
      period: 'weekly',
      target: 2,
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
