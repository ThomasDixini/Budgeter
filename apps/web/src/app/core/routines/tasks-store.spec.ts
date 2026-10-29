import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { Clock } from '../calendar/clock';
import { FixedClock } from '../calendar/fixed-clock';
import { IdGenerator } from '../ids/id-generator';
import { SequentialIdGenerator } from '../ids/sequential-id-generator';
import { FakeGoalsGateway, provideFakeRoutinesGateways } from './fake-routines-gateways';
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

function createStore(
  gateway = new FakeTasksGateway(),
  goals = new FakeGoalsGateway(),
): {
  store: TasksStore;
  gateway: FakeTasksGateway;
  goals: FakeGoalsGateway;
  errors: RecordingErrorHandler;
} {
  const errors = new RecordingErrorHandler();
  TestBed.configureTestingModule({
    providers: [
      ...provideFakeRoutinesGateways(undefined, goals),
      { provide: TasksGateway, useValue: gateway },
      { provide: Clock, useValue: new FixedClock(MONDAY) },
      { provide: IdGenerator, useValue: new SequentialIdGenerator() },
      { provide: ErrorHandler, useValue: errors },
    ],
  });
  return { store: TestBed.inject(TasksStore), gateway, goals, errors };
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

  it('reloads the goals after a task is checked, since tasks can count toward them', () => {
    const { store, goals } = createStore();

    store.toggleDone('t1');

    expect(goals.listedDays).toHaveLength(2);
  });

  it('does not reload the goals when checking the task failed', () => {
    const { store, gateway, goals } = createStore();
    gateway.failure = new Error('offline');

    store.toggleDone('t1');

    expect(goals.listedDays).toHaveLength(1);
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

  it('deletes a task and puts it back if the gateway rejects it', () => {
    const { store, gateway } = createStore();

    store.deleteTask('t1');
    expect(todayIds(store)).toEqual(['t2', 't4', 't5']);
    gateway.failure = new Error('offline');
    store.deleteTask('t2');

    expect(todayIds(store)).toEqual(['t2', 't4', 't5']);
    expect(gateway.deleted).toEqual(['t1', 't2']);
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
      store.updateTask('t5', { ...DAILY_READ, title: 'Second edit' });

      gateway.pending[1].next({} as Task);
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
});
