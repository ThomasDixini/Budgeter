import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { Clock } from '../calendar/clock';
import { FixedClock } from '../calendar/fixed-clock';
import { IdGenerator } from '../ids/id-generator';
import { SequentialIdGenerator } from '../ids/sequential-id-generator';
import { CategoryCreations } from './category-creations';
import { provideFakeRoutinesGateways } from './fake-routines-gateways';
import { FakeTasksGateway } from './fake-tasks-gateway';
import { Task } from './task';
import { TasksGateway } from './tasks-gateway';
import { TasksStore } from './tasks-store';

/** Monday, October 26, 2026. */
const MONDAY = new Date(2026, 9, 26, 9, 0);

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

function createStore(
  gateway = new FakeTasksGateway(),
  clock: Clock = new FixedClock(MONDAY),
): {
  store: TasksStore;
  gateway: FakeTasksGateway;
  errors: RecordingErrorHandler;
} {
  const errors = new RecordingErrorHandler();
  TestBed.configureTestingModule({
    providers: [
      ...provideFakeRoutinesGateways(),
      { provide: TasksGateway, useValue: gateway },
      { provide: Clock, useValue: clock },
      { provide: IdGenerator, useValue: new SequentialIdGenerator() },
      { provide: ErrorHandler, useValue: errors },
    ],
  });
  return { store: TestBed.inject(TasksStore), gateway, errors };
}

/** Deletions that stay open until a test answers them, to play out a failure that comes late. */
class ControlledDeleteTasksGateway extends FakeTasksGateway {
  readonly pendingDeletes: Subject<void>[] = [];

  override delete(taskId: string): Observable<void> {
    this.deleted.push(taskId);
    const reply = new Subject<void>();
    this.pendingDeletes.push(reply);
    return reply;
  }
}

function allIds(store: TasksStore): string[] {
  return store.tasks().map((task) => task.id);
}

function categoryOf(store: TasksStore, taskId: string): string | undefined {
  return store.tasks().find((task) => task.id === taskId)?.categoryId;
}

/** Saves that stay open until a test answers them, to play out slow or reordered replies. */
class ControlledSaveTasksGateway extends FakeTasksGateway {
  readonly pending: Subject<Task>[] = [];

  override save(task: Task): Observable<Task> {
    this.saved.push(task);
    const reply = new Subject<Task>();
    this.pending.push(reply);
    return reply;
  }
}

function todayIds(store: TasksStore): string[] {
  return store.todayTasks().map(({ task }) => task.id);
}

describe('TasksStore', () => {
  it('lists only the tasks that repeat on today', () => {
    expect(todayIds(createStore().store)).toEqual(['t1', 't2', 't4', 't5']);
  });

  it('asks which tasks were done on today, not another day', () => {
    const { gateway } = createStore();

    expect(gateway.askedDays).toEqual(['2026-10-26']);
  });

  describe('followClock', () => {
    // Regression: the store fixed its day when it started, so past midnight the checkboxes kept
    // marking the day before.
    it('moves the list and the done marks on to the new day', () => {
      const gateway = new FakeTasksGateway(undefined, ['t1']);
      gateway.completedOnDay.set('2026-10-27', ['t3']);
      const clock = new MovableClock(new Date(2026, 9, 26, 23, 59));
      const { store } = createStore(gateway, clock);

      clock.moment = new Date(2026, 9, 27, 0, 1);
      store.followClock();

      expect(todayIds(store)).toContain('t3');
      expect(
        store
          .todayTasks()
          .filter(({ isDone }) => isDone)
          .map(({ task }) => task.id),
      ).toEqual(['t3']);
    });

    it('checks tasks off on the new day once it moved on', () => {
      const clock = new MovableClock(new Date(2026, 9, 26, 23, 59));
      const { store, gateway } = createStore(new FakeTasksGateway(), clock);
      clock.moment = new Date(2026, 9, 27, 0, 1);
      store.followClock();

      store.toggleDone('t1');

      expect(gateway.doneChanges.at(-1)?.isoDay).toBe('2026-10-27');
    });

    it('asks for nothing again within the same day', () => {
      const clock = new MovableClock(new Date(2026, 9, 26, 9, 0));
      const { store, gateway } = createStore(new FakeTasksGateway(), clock);

      clock.moment = new Date(2026, 9, 26, 18, 0);
      store.followClock();

      expect(gateway.askedDays).toEqual(['2026-10-26']);
    });
  });

  it('marks the tasks already done today', () => {
    const { store } = createStore(new FakeTasksGateway(undefined, ['t2']));

    expect(store.todayTasks().find(({ task }) => task.id === 't2')?.isDone).toBe(true);
  });

  it('checks a task off for today through the gateway', () => {
    const { store, gateway } = createStore();

    store.toggleDone('t1');

    expect(store.todayTasks()[0].isDone).toBe(true);
    expect(gateway.doneChanges).toEqual([{ taskId: 't1', isoDay: '2026-10-26', isDone: true }]);
  });

  it('unchecks a task done today', () => {
    const { store, gateway } = createStore(new FakeTasksGateway(undefined, ['t1']));

    store.toggleDone('t1');

    expect(store.todayTasks()[0].isDone).toBe(false);
    expect(gateway.doneChanges[0].isDone).toBe(false);
  });

  it('restores the check when the gateway rejects it', () => {
    const { store, gateway, errors } = createStore();
    gateway.failure = new Error('offline');

    store.toggleDone('t1');

    expect(store.todayTasks()[0].isDone).toBe(false);
    expect(errors.errors).toEqual([gateway.failure]);
  });

  it('sets a one-off task for today and saves it', () => {
    const { store, gateway } = createStore();

    const task = store.addTask({ title: 'Call the bank', repeat: 'once', days: [] });

    expect(task).toMatchObject({ id: 'id-1', date: '2026-10-26' });
    expect(todayIds(store).at(-1)).toBe('id-1');
    expect(gateway.saved).toEqual([task]);
  });

  it('keeps a weekly task off today when it repeats on other days', () => {
    const { store } = createStore();

    store.addTask({ title: 'Gym', repeat: 'weekly', days: [1, 3] });

    expect(todayIds(store)).not.toContain('id-1');
    expect(store.tasks().at(-1)?.date).toBeUndefined();
  });

  it('drops a task the gateway rejects', () => {
    const { store, gateway } = createStore();
    gateway.failure = new Error('offline');

    store.addTask({ title: 'Call the bank', repeat: 'daily', days: [] });

    expect(store.tasks().map((task) => task.id)).toEqual(['t1', 't2', 't3', 't4', 't5']);
  });

  it('deletes a task through the gateway', () => {
    const { store, gateway } = createStore();

    store.deleteTask('t1');

    expect(todayIds(store)).toEqual(['t2', 't4', 't5']);
    expect(gateway.deleted).toEqual(['t1']);
  });

  it('shows a task as deleted while its deletion is pending', () => {
    const { store } = createStore(new ControlledDeleteTasksGateway());

    store.deleteTask('t2');

    expect(allIds(store)).toEqual(['t1', 't3', 't4', 't5']);
  });

  it('puts a deleted task back in its place when the gateway rejects it', () => {
    const { store, gateway, errors } = createStore();
    gateway.failure = new Error('offline');

    store.deleteTask('t2');

    expect(allIds(store)).toEqual(['t1', 't2', 't3', 't4', 't5']);
    expect(errors.errors).toEqual([gateway.failure]);
  });

  // Regression: a failed deletion put back a copy of the whole list, dropping what was added meanwhile.
  it('keeps a task added while a deletion was pending when that deletion fails', () => {
    const gateway = new ControlledDeleteTasksGateway();
    const { store } = createStore(gateway);
    store.deleteTask('t2');
    const added = store.addTask({ title: 'Call the bank', repeat: 'once', days: [] });

    gateway.pendingDeletes[0].error(new Error('offline'));

    expect(allIds(store)).toEqual(['t1', 't2', 't3', 't4', 't5', added.id]);
  });

  it('keeps another task deleted meanwhile out when an earlier deletion fails', () => {
    const gateway = new ControlledDeleteTasksGateway();
    const { store } = createStore(gateway);
    store.deleteTask('t2');
    store.deleteTask('t4');
    gateway.pendingDeletes[1].next();

    gateway.pendingDeletes[0].error(new Error('offline'));

    expect(allIds(store)).toEqual(['t1', 't2', 't3', 't5']);
  });

  describe('detachCategory', () => {
    it('takes a deleted category off the tasks that used it', () => {
      const { store } = createStore();

      store.detachCategory('study');

      expect([categoryOf(store, 't2'), categoryOf(store, 't3'), categoryOf(store, 't4')]).toEqual([
        undefined,
        undefined,
        'networking',
      ]);
    });

    it('gives the category back to those tasks when asked, as after a rejected deletion', () => {
      const { store } = createStore();
      const reattach = store.detachCategory('study');

      reattach();

      expect([categoryOf(store, 't2'), categoryOf(store, 't3')]).toEqual(['study', 'study']);
    });

    it('leaves a task given another category since with that one', () => {
      const { store } = createStore();
      const reattach = store.detachCategory('study');
      store.updateTask('t2', {
        title: 'Review class notes',
        categoryId: 'reading',
        repeat: 'daily',
        days: [],
      });

      reattach();

      expect([categoryOf(store, 't2'), categoryOf(store, 't3')]).toEqual(['reading', 'study']);
    });
  });

  it('sets a one-time task for the day the draft names, not always today', () => {
    const { store, gateway } = createStore();

    const task = store.addTask({
      title: 'Renew the passport',
      repeat: 'once',
      days: [],
      date: '2026-12-01',
    });

    expect(task.date).toBe('2026-12-01');
    expect(todayIds(store)).not.toContain(task.id);
    expect(gateway.saved).toEqual([task]);
  });

  describe('updateTask', () => {
    const DAILY_READ = { title: 'Read 30 pages', repeat: 'daily', days: [] } as const;

    it('edits the task and saves it under the same id', () => {
      const { store, gateway } = createStore();

      const task = store.updateTask('t5', { ...DAILY_READ, categoryId: 'study' });

      expect(task).toEqual({ id: 't5', ...DAILY_READ, categoryId: 'study', date: undefined });
      expect(store.tasks().find((current) => current.id === 't5')).toEqual(task);
      expect(gateway.saved).toEqual([task]);
    });

    it('moves a task out of today and into the "not today" list when its day changes', () => {
      const { store } = createStore();

      store.updateTask('t1', { title: 'Reply to pending emails', repeat: 'weekly', days: [1] });

      expect(todayIds(store)).not.toContain('t1');
      expect(store.notToday().map((item) => item.task.id)).toContain('t1');
    });

    it('ignores a task it does not have', () => {
      const { store, gateway } = createStore();

      expect(store.updateTask('missing', DAILY_READ)).toBeUndefined();
      expect(gateway.saved).toEqual([]);
    });

    it('puts back only the failed task, keeping what was added in the meantime', () => {
      const gateway = new ControlledSaveTasksGateway();
      const { store } = createStore(gateway);
      store.updateTask('t5', DAILY_READ);

      const added = store.addTask({ title: 'Call the bank', repeat: 'once', days: [] });
      gateway.pending[0].error(new Error('offline'));

      expect(store.tasks().find((task) => task.id === 't5')?.title).toBe('Read 20 pages');
      expect(store.tasks().map((task) => task.id)).toContain(added.id);
    });

    // Regression: rolling back an old failed edit used to undo a newer edit that had worked.
    it('does not undo a newer edit of the same task when an older save fails', () => {
      const gateway = new ControlledSaveTasksGateway();
      const { store } = createStore(gateway);
      store.updateTask('t5', { ...DAILY_READ, title: 'First edit' });
      const second = store.updateTask('t5', { ...DAILY_READ, title: 'Second edit' })!;

      gateway.pending[1].next(second);
      gateway.pending[0].error(new Error('offline'));

      expect(store.tasks().find((task) => task.id === 't5')?.title).toBe('Second edit');
    });

    it('does not let a slow answer to an earlier edit overwrite a newer one', () => {
      const gateway = new ControlledSaveTasksGateway();
      const { store } = createStore(gateway);
      const first = store.updateTask('t5', { ...DAILY_READ, title: 'First edit' })!;
      const second = store.updateTask('t5', { ...DAILY_READ, title: 'Second edit' })!;

      gateway.pending[1].next(second);
      gateway.pending[0].next(first);

      expect(store.tasks().find((task) => task.id === 't5')?.title).toBe('Second edit');
    });
  });

  describe('a task edited before its add is answered', () => {
    const DRAFT = { title: 'Call the bank', repeat: 'once', days: [] } as const;

    it('keeps the edit when the add is answered late', () => {
      const gateway = new ControlledSaveTasksGateway();
      const { store } = createStore(gateway);
      const added = store.addTask(DRAFT);
      store.updateTask(added.id, { ...DRAFT, title: 'Call the bank back' });

      gateway.pending[0].next(added);

      expect(store.tasks().find((task) => task.id === added.id)?.title).toBe('Call the bank back');
    });

    it('keeps the edit when the add fails, since the edit is saved by its own request', () => {
      const gateway = new ControlledSaveTasksGateway();
      const { store } = createStore(gateway);
      const added = store.addTask(DRAFT);
      store.updateTask(added.id, { ...DRAFT, title: 'Call the bank back' });

      gateway.pending[0].error(new Error('offline'));

      expect(store.tasks().find((task) => task.id === added.id)?.title).toBe('Call the bank back');
    });

    it('drops an add that failed and was not touched', () => {
      const gateway = new ControlledSaveTasksGateway();
      const { store } = createStore(gateway);
      const added = store.addTask(DRAFT);

      gateway.pending[0].error(new Error('offline'));

      expect(store.tasks().map((task) => task.id)).not.toContain(added.id);
    });
  });

  it('lists the tasks that are not due today, for editing and deleting', () => {
    const { store } = createStore();

    expect(store.notToday().map((item) => item.task.id)).toEqual(['t3']);
  });

  describe('a task of a category still being created', () => {
    const LANGUAGES = { id: 'languages', name: 'Languages', color: '#86EFAC' };
    const PRACTICE = {
      title: 'Practice',
      categoryId: 'languages',
      repeat: 'daily',
      days: [],
    } as const;

    function createWithPendingCategory(): {
      store: TasksStore;
      gateway: FakeTasksGateway;
      category: Subject<typeof LANGUAGES>;
    } {
      const setup = createStore();
      const category = new Subject<typeof LANGUAGES>();
      TestBed.inject(CategoryCreations)
        .track('languages', category)
        .subscribe({
          error: () => undefined,
        });
      return { ...setup, category };
    }

    // Regression: the task could reach the API before its new category and be refused with 404.
    it('is saved only once the category is', () => {
      const { store, gateway, category } = createWithPendingCategory();
      store.addTask(PRACTICE);
      expect(gateway.saved).toEqual([]);

      category.next(LANGUAGES);
      category.complete();

      expect(gateway.saved.map((task) => task.title)).toEqual(['Practice']);
    });

    it('is dropped, unsent, when saving the category fails', () => {
      const { store, gateway, category } = createWithPendingCategory();
      const task = store.addTask(PRACTICE);

      category.error(new Error('offline'));

      expect(gateway.saved).toEqual([]);
      expect(allIds(store)).not.toContain(task.id);
    });

    it('puts an edited task back as it was when saving the category fails', () => {
      const { store, category } = createWithPendingCategory();
      store.updateTask('t5', PRACTICE);

      category.error(new Error('offline'));

      expect(store.tasks().find((task) => task.id === 't5')?.categoryId).toBe('reading');
    });
  });
});
