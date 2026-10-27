import { RoutinesStore } from './routines-store';

function createStore(): RoutinesStore {
  return new RoutinesStore();
}

describe('RoutinesStore', () => {
  it('toggles a task', () => {
    const store = createStore();

    store.toggleTask('t3');

    expect(store.tasks().find((task) => task.id === 't3')?.done).toBe(true);
  });

  it('increments a goal without passing its target', () => {
    const store = createStore();

    store.incrementGoal('g3');

    expect(store.goals().find((goal) => goal.id === 'g3')?.done).toBe(1);
  });

  it('adds a goal with no progress', () => {
    const store = createStore();

    const goal = store.addGoal({
      categoryId: 'study',
      title: 'Read the docs',
      type: 'frequency',
      period: 'weekly',
      target: 2,
    });

    expect(store.goals().at(-1)).toEqual({ ...goal, done: 0 });
  });

  it('adds a category with a fresh id', () => {
    const store = createStore();

    const category = store.addCategory('Languages', '#86EFAC');

    expect(store.categories().at(-1)).toEqual(category);
  });

  it('saves an edited routine', () => {
    const store = createStore();
    const weekdays = store.routines()[0];

    store.saveRoutine({ ...weekdays, end: '18:00' });

    expect(store.routines()[0].end).toBe('18:00');
  });

  it('sums weekly minutes of a category across routines', () => {
    expect(createStore().weeklyMinutes('networking')).toBe(600);
  });

  it('lists the routine blocks of a category', () => {
    expect(createStore().categoryBlocks('study')).toEqual([
      { name: 'C# study', when: 'Mon–Fri · 13:30–15:00' },
    ]);
  });
});
