import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { Clock } from '../calendar/clock';
import { FixedClock } from '../calendar/fixed-clock';
import { IdGenerator } from '../ids/id-generator';
import { SequentialIdGenerator } from '../ids/sequential-id-generator';
import { Bill } from './bills';
import { FakeSinkingFundsGateway, SAMPLE_SINKING_FUND } from './fake-sinking-funds-gateway';
import { SinkingFundDraft, SinkingFundsOverview } from './sinking-funds';
import { SinkingFundsGateway } from './sinking-funds-gateway';
import { SinkingFundsStore } from './sinking-funds-store';

/** Tuesday, November 3, 2026. */
const NOW = new Date(2026, 10, 3, 9, 0);
const TODAY = '2026-11-03';

const ROLLED_BILL: Bill = {
  id: 'ipva-2026',
  kind: 'payable',
  description: 'IPVA',
  categoryId: 'transport',
  amountCents: 120000,
  dueDate: '2026-11-03',
};

const NEW_FUND: SinkingFundDraft = {
  description: 'Insurance',
  categoryId: 'transport',
  amountCents: 60000,
  schedule: { kind: 'everyMonths', intervalMonths: 6, nextDueDate: '2027-02-10' },
};

/** Records reported errors instead of logging them. */
class RecordingErrorHandler extends ErrorHandler {
  readonly errors: unknown[] = [];

  override handleError(error: unknown): void {
    this.errors.push(error);
  }
}

/** Fails only the roll, so the list still works. */
class FailingRollGateway extends FakeSinkingFundsGateway {
  override roll(today: string): Observable<readonly Bill[]> {
    this.rolledDays.push(today);
    return throwError(() => new Error('roll failed'));
  }
}

/** Fails only the list. */
class FailingListGateway extends FakeSinkingFundsGateway {
  override list(today: string): Observable<SinkingFundsOverview> {
    this.askedDays.push(today);
    return this.failure === undefined ? of(this.overviewToServe) : throwError(() => this.failure);
  }

  override roll(today: string): Observable<readonly Bill[]> {
    this.rolledDays.push(today);
    return of([]);
  }
}

/** Lists that stay open until a test answers them, to play out overlapping refreshes. */
class ControlledListGateway extends FakeSinkingFundsGateway {
  readonly pendingLists: Subject<SinkingFundsOverview>[] = [];

  override list(today: string): Observable<SinkingFundsOverview> {
    this.askedDays.push(today);
    const reply = new Subject<SinkingFundsOverview>();
    this.pendingLists.push(reply);
    return reply;
  }
}

function createStore(gateway: SinkingFundsGateway = new FakeSinkingFundsGateway()): {
  store: SinkingFundsStore;
  errors: RecordingErrorHandler;
} {
  const errors = new RecordingErrorHandler();
  TestBed.configureTestingModule({
    providers: [
      SinkingFundsStore,
      { provide: SinkingFundsGateway, useValue: gateway },
      { provide: Clock, useValue: new FixedClock(NOW) },
      { provide: IdGenerator, useValue: new SequentialIdGenerator() },
      { provide: ErrorHandler, useValue: errors },
    ],
  });
  return { store: TestBed.inject(SinkingFundsStore), errors };
}

describe('SinkingFundsStore', () => {
  it('rolls the funds due today, then lists them', () => {
    const gateway = new FakeSinkingFundsGateway();

    const { store } = createStore(gateway);

    expect(store.today).toBe(TODAY);
    expect(gateway.rolledDays).toEqual([TODAY]);
    expect(gateway.askedDays).toEqual([TODAY]);
  });

  it('exposes the funds, the monthly total and the rolled bills', () => {
    const gateway = new FakeSinkingFundsGateway();
    gateway.billsToRoll = [ROLLED_BILL];

    const { store } = createStore(gateway);

    expect(store.funds()).toEqual([SAMPLE_SINKING_FUND]);
    expect(store.totalMonthlyCents()).toBe(10000);
    expect(store.rolledBills()).toEqual([ROLLED_BILL]);
    expect(store.isLoaded()).toBe(true);
    expect(store.hasLoadFailed()).toBe(false);
  });

  it('still lists the funds when the roll fails, leaving no rolled bills', () => {
    const { store, errors } = createStore(new FailingRollGateway());

    expect(store.funds()).toEqual([SAMPLE_SINKING_FUND]);
    expect(store.rolledBills()).toEqual([]);
    expect(store.hasLoadFailed()).toBe(false);
    expect(errors.errors).toHaveLength(1);
  });

  it('reports a failed list and recovers on reload', () => {
    const gateway = new FailingListGateway();
    gateway.failure = new Error('list failed');
    const { store, errors } = createStore(gateway);
    expect(store.hasLoadFailed()).toBe(true);
    expect(store.isLoaded()).toBe(false);
    expect(errors.errors).toHaveLength(1);

    gateway.failure = undefined;
    store.reload();

    expect(store.hasLoadFailed()).toBe(false);
    expect(store.isLoaded()).toBe(true);
    expect(store.funds()).toEqual([SAMPLE_SINKING_FUND]);
  });

  it('saves a new fund under a generated id and refreshes the list without rolling', () => {
    const gateway = new FakeSinkingFundsGateway();
    const { store } = createStore(gateway);

    store.save(NEW_FUND);

    expect(gateway.saved).toHaveLength(1);
    expect(gateway.saved[0].id).toBeTruthy();
    expect(gateway.saved[0]).toMatchObject({ today: TODAY, draft: NEW_FUND });
    expect(gateway.askedDays).toEqual([TODAY, TODAY]);
    expect(gateway.rolledDays).toEqual([TODAY]);
  });

  it('saves an existing fund under its own id', () => {
    const gateway = new FakeSinkingFundsGateway();
    const { store } = createStore(gateway);

    store.save(NEW_FUND, 'ipva');

    expect(gateway.saved.map((call) => call.id)).toEqual(['ipva']);
  });

  it('shows the refreshed list after a save', () => {
    const gateway = new FakeSinkingFundsGateway();
    const { store } = createStore(gateway);
    gateway.overviewToServe = { funds: [], totalMonthlyCents: 0 };

    store.save(NEW_FUND);

    expect(store.funds()).toEqual([]);
    expect(store.totalMonthlyCents()).toBe(0);
  });

  it('deletes a fund and refreshes the list', () => {
    const gateway = new FakeSinkingFundsGateway();
    const { store } = createStore(gateway);

    store.remove('ipva');

    expect(gateway.deleted).toEqual(['ipva']);
    expect(gateway.askedDays).toEqual([TODAY, TODAY]);
  });

  it('flags a failed save and keeps the old list', () => {
    const gateway = new FakeSinkingFundsGateway();
    const { store, errors } = createStore(gateway);
    gateway.failure = new Error('save failed');

    store.save(NEW_FUND);

    expect(store.hasActionFailed()).toBe(true);
    expect(store.funds()).toEqual([SAMPLE_SINKING_FUND]);
    expect(errors.errors).toHaveLength(1);
  });

  it('flags a failed delete and clears the flag on the next action', () => {
    const gateway = new FakeSinkingFundsGateway();
    const { store } = createStore(gateway);
    gateway.failure = new Error('delete failed');
    store.remove('ipva');
    expect(store.hasActionFailed()).toBe(true);

    gateway.failure = undefined;
    store.remove('ipva');

    expect(store.hasActionFailed()).toBe(false);
  });

  it('lets the later answer win when two refreshes overlap', () => {
    const gateway = new ControlledListGateway();
    const { store } = createStore(gateway);
    gateway.pendingLists[0].next({ funds: [], totalMonthlyCents: 0 });
    store.remove('a');
    store.remove('b');
    const [, first, second] = gateway.pendingLists;

    second.next({ funds: [SAMPLE_SINKING_FUND], totalMonthlyCents: 10000 });
    first.next({ funds: [], totalMonthlyCents: 0 });

    expect(store.funds()).toEqual([SAMPLE_SINKING_FUND]);
    expect(store.totalMonthlyCents()).toBe(10000);
  });
});
