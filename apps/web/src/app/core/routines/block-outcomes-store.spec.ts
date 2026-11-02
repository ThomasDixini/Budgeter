import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { Clock } from '../calendar/clock';
import { FixedClock } from '../calendar/fixed-clock';
import { BlockOutcomesGateway } from './block-outcomes-gateway';
import { BlockOutcomesStore } from './block-outcomes-store';
import { BlockOutcome } from './day-plan';
import { FakeBlockOutcomesGateway } from './fake-block-outcomes-gateway';
import { FakeGoalsGateway, provideFakeRoutinesGateways } from './fake-routines-gateways';

const TODAY = new Date(2026, 9, 27, 20, 40);
const GYM_DONE: BlockOutcome = {
  routineId: 'weekdays',
  blockId: 'gym',
  outcome: 'done',
  at: '19:00',
};

/** Records reported errors instead of logging them. */
class RecordingErrorHandler extends ErrorHandler {
  readonly errors: unknown[] = [];

  override handleError(error: unknown): void {
    this.errors.push(error);
  }
}

function createStore(
  gateway = new FakeBlockOutcomesGateway([GYM_DONE]),
  goals = new FakeGoalsGateway(),
): {
  store: BlockOutcomesStore;
  gateway: FakeBlockOutcomesGateway;
  goals: FakeGoalsGateway;
  errors: RecordingErrorHandler;
} {
  const errors = new RecordingErrorHandler();
  TestBed.configureTestingModule({
    providers: [
      ...provideFakeRoutinesGateways(undefined, goals),
      { provide: BlockOutcomesGateway, useValue: gateway },
      { provide: Clock, useValue: new FixedClock(TODAY) },
      { provide: ErrorHandler, useValue: errors },
    ],
  });
  return { store: TestBed.inject(BlockOutcomesStore), gateway, goals, errors };
}

describe('BlockOutcomesStore', () => {
  it("loads today's outcomes", () => {
    expect(createStore().store.outcomes()).toEqual([GYM_DONE]);
  });

  it('records a block as done now, for today', () => {
    const { store, gateway } = createStore();

    store.record('weekdays', 'project', 'done', 20 * 60 + 40);

    const outcome = { routineId: 'weekdays', blockId: 'project', outcome: 'done', at: '20:40' };
    expect(store.outcomes().at(-1)).toEqual(outcome);
    expect(gateway.recorded).toEqual([{ isoDay: '2026-10-27', outcome }]);
  });

  it('replaces an earlier outcome of the same block', () => {
    const { store } = createStore();

    store.record('weekdays', 'gym', 'skipped', 19 * 60);

    expect(store.outcomes()).toEqual([{ ...GYM_DONE, outcome: 'skipped' }]);
  });

  it('reloads the goals after recording or undoing, since blocks can count toward them', () => {
    const { store, goals } = createStore();

    const loadedOnStart = goals.listedDays.length;

    store.record('weekdays', 'project', 'done', 20 * 60 + 40);
    store.undo('weekdays', 'project');

    expect(goals.listedDays.length - loadedOnStart).toBe(2);
  });

  it('does not reload the goals when recording failed', () => {
    const { store, gateway, goals } = createStore();
    gateway.failure = new Error('offline');
    const loadedOnStart = goals.listedDays.length;

    store.record('weekdays', 'project', 'done', 20 * 60 + 40);

    expect(goals.listedDays.length).toBe(loadedOnStart);
  });

  it('undoes an outcome through the gateway', () => {
    const { store, gateway } = createStore();

    store.undo('weekdays', 'gym');

    expect(store.outcomes()).toEqual([]);
    expect(gateway.undone).toEqual([
      { isoDay: '2026-10-27', routineId: 'weekdays', blockId: 'gym' },
    ]);
  });

  it('keeps the outcome when undoing it fails', () => {
    const { store, gateway } = createStore();
    gateway.failure = new Error('offline');

    store.undo('weekdays', 'gym');

    expect(store.outcomes()).toEqual([GYM_DONE]);
  });

  it('drops the outcome when the gateway rejects it', () => {
    const { store, gateway, errors } = createStore();
    gateway.failure = new Error('offline');

    store.record('weekdays', 'project', 'done', 20 * 60 + 40);

    expect(store.outcomes()).toEqual([GYM_DONE]);
    expect(errors.errors).toEqual([gateway.failure]);
  });
});

/** Records and undos that stay open until a test answers them, to play out late failures. */
class ControlledBlockOutcomesGateway extends FakeBlockOutcomesGateway {
  readonly pendingRecords: Subject<BlockOutcome>[] = [];
  readonly pendingUndos: Subject<void>[] = [];

  override record(isoDay: string, outcome: BlockOutcome): Observable<BlockOutcome> {
    this.recorded.push({ isoDay, outcome });
    const reply = new Subject<BlockOutcome>();
    this.pendingRecords.push(reply);
    return reply;
  }

  override undo(isoDay: string, routineId: string, blockId: string): Observable<void> {
    this.undone.push({ isoDay, routineId, blockId });
    const reply = new Subject<void>();
    this.pendingUndos.push(reply);
    return reply;
  }
}

function blockIds(store: BlockOutcomesStore): string[] {
  return store.outcomes().map((outcome) => outcome.blockId);
}

describe('BlockOutcomesStore while requests are in flight', () => {
  const EVENING = 20 * 60 + 40;

  it('puts back the outcome a failed record replaced', () => {
    const { store, gateway } = createStore();
    gateway.failure = new Error('offline');

    store.record('weekdays', 'gym', 'skipped', 19 * 60);

    expect(store.outcomes()).toEqual([GYM_DONE]);
  });

  // Regression: a failed record put back a copy of the whole list, dropping a block ended meanwhile.
  it('keeps a block ended while a record was pending when that record fails', () => {
    const gateway = new ControlledBlockOutcomesGateway([GYM_DONE]);
    const { store } = createStore(gateway);
    store.record('weekdays', 'project', 'done', EVENING);
    store.record('weekdays', 'guitar', 'done', EVENING + 30);

    gateway.pendingRecords[0].error(new Error('offline'));

    expect(blockIds(store)).toEqual(['gym', 'guitar']);
  });

  it('keeps a newer outcome of the block when an older record of it fails', () => {
    const gateway = new ControlledBlockOutcomesGateway([GYM_DONE]);
    const { store } = createStore(gateway);
    store.record('weekdays', 'project', 'done', EVENING);
    store.record('weekdays', 'project', 'skipped', EVENING + 5);

    gateway.pendingRecords[0].error(new Error('offline'));

    expect(store.outcomes().at(-1)).toMatchObject({ blockId: 'project', outcome: 'skipped' });
  });

  it('puts an outcome back in its place when undoing it fails, keeping one recorded meanwhile', () => {
    const gateway = new ControlledBlockOutcomesGateway([GYM_DONE]);
    const { store } = createStore(gateway);
    store.undo('weekdays', 'gym');
    store.record('weekdays', 'project', 'done', EVENING);

    gateway.pendingUndos[0].error(new Error('offline'));

    expect(blockIds(store)).toEqual(['gym', 'project']);
  });

  // Regression: a record that failed after the page moved to another day put the old day's list on it.
  it('leaves the day now shown alone when a record of the day before fails', () => {
    const gateway = new ControlledBlockOutcomesGateway([GYM_DONE]);
    gateway.outcomesOnDay.set('2026-10-26', []);
    const { store, errors } = createStore(gateway);
    store.record('weekdays', 'project', 'done', EVENING);
    store.showDay('2026-10-26');

    gateway.pendingRecords[0].error(new Error('offline'));

    expect(store.outcomes()).toEqual([]);
    expect(errors.errors).toHaveLength(1);
  });

  it('does not bring an outcome of the day before onto the day now shown when undoing it fails', () => {
    const gateway = new ControlledBlockOutcomesGateway([GYM_DONE]);
    gateway.outcomesOnDay.set('2026-10-26', []);
    const { store } = createStore(gateway);
    store.undo('weekdays', 'gym');
    store.showDay('2026-10-26');

    gateway.pendingUndos[0].error(new Error('offline'));

    expect(store.outcomes()).toEqual([]);
  });
});

describe('BlockOutcomesStore showDay', () => {
  it('loads another day and records on it', () => {
    const { store, gateway } = createStore();

    store.showDay('2026-10-26');
    store.record('night', 'patrol', 'done', 23 * 60);

    expect(gateway.listedDays).toEqual(['2026-10-27', '2026-10-26']);
    expect(gateway.recorded.at(-1)?.isoDay).toBe('2026-10-26');
  });

  it('does not reload the day already shown', () => {
    const { store, gateway } = createStore();

    store.showDay('2026-10-27');

    expect(gateway.listedDays).toEqual(['2026-10-27']);
  });
});
