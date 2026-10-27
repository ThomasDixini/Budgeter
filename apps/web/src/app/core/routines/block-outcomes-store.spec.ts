import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Clock } from '../calendar/clock';
import { FixedClock } from '../calendar/fixed-clock';
import { BlockOutcomesGateway } from './block-outcomes-gateway';
import { BlockOutcomesStore } from './block-outcomes-store';
import { BlockOutcome } from './day-plan';
import { FakeBlockOutcomesGateway } from './fake-block-outcomes-gateway';

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

function createStore(gateway = new FakeBlockOutcomesGateway([GYM_DONE])): {
  store: BlockOutcomesStore;
  gateway: FakeBlockOutcomesGateway;
  errors: RecordingErrorHandler;
} {
  const errors = new RecordingErrorHandler();
  TestBed.configureTestingModule({
    providers: [
      { provide: BlockOutcomesGateway, useValue: gateway },
      { provide: Clock, useValue: new FixedClock(TODAY) },
      { provide: ErrorHandler, useValue: errors },
    ],
  });
  return { store: TestBed.inject(BlockOutcomesStore), gateway, errors };
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

  it('drops the outcome when the gateway rejects it', () => {
    const { store, gateway, errors } = createStore();
    gateway.failure = new Error('offline');

    store.record('weekdays', 'project', 'done', 20 * 60 + 40);

    expect(store.outcomes()).toEqual([GYM_DONE]);
    expect(errors.errors).toEqual([gateway.failure]);
  });
});
