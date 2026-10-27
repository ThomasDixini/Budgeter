import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Clock } from '../calendar/clock';
import { FixedClock } from '../calendar/fixed-clock';
import { IdGenerator } from '../ids/id-generator';
import { SequentialIdGenerator } from '../ids/sequential-id-generator';
import { FakeTasksGateway } from './fake-tasks-gateway';
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

function createStore(gateway = new FakeTasksGateway()): {
  store: TasksStore;
  gateway: FakeTasksGateway;
  errors: RecordingErrorHandler;
} {
  const errors = new RecordingErrorHandler();
  TestBed.configureTestingModule({
    providers: [
      { provide: TasksGateway, useValue: gateway },
      { provide: Clock, useValue: new FixedClock(MONDAY) },
      { provide: IdGenerator, useValue: new SequentialIdGenerator() },
      { provide: ErrorHandler, useValue: errors },
    ],
  });
  return { store: TestBed.inject(TasksStore), gateway, errors };
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
});
