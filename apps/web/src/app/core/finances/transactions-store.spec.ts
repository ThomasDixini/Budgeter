import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { Clock } from '../calendar/clock';
import { FixedClock } from '../calendar/fixed-clock';
import { IdGenerator } from '../ids/id-generator';
import { SequentialIdGenerator } from '../ids/sequential-id-generator';
import {
  FakeFinanceReferencesGateway,
  FakeTransactionsGateway,
  SAMPLE_OCTOBER,
} from './fake-finances-gateways';
import { Transaction, TransactionDraft } from './transaction';
import { FinanceReferencesGateway, TransactionsGateway } from './transactions-gateway';
import { TransactionsStore } from './transactions-store';

/** Saturday, October 31, 2026. */
const HALLOWEEN = new Date(2026, 9, 31, 20, 0);
const [GROCERIES, PHARMACY] = SAMPLE_OCTOBER;

const FUEL: TransactionDraft = {
  date: '2026-10-29',
  description: 'Fuel',
  categoryId: 'food',
  accountId: 'credit-card',
  amountCents: -21000,
};

/** Records reported errors instead of logging them. */
class RecordingErrorHandler extends ErrorHandler {
  readonly errors: unknown[] = [];

  override handleError(error: unknown): void {
    this.errors.push(error);
  }
}

/** Month lists that stay open until a test answers them, to play out slow or reordered replies. */
class ControlledListTransactionsGateway extends FakeTransactionsGateway {
  readonly pendingLists = new Map<string, Subject<readonly Transaction[]>>();

  override listMonth(month: string): Observable<readonly Transaction[]> {
    const reply = new Subject<readonly Transaction[]>();
    this.pendingLists.set(month, reply);
    return reply;
  }
}

/** Saves that stay open until a test answers them, to play out a failure that comes late. */
class ControlledSaveTransactionsGateway extends FakeTransactionsGateway {
  readonly pendingSaves: Subject<Transaction>[] = [];

  override save(transaction: Transaction): Observable<Transaction> {
    this.saved.push(transaction);
    const reply = new Subject<Transaction>();
    this.pendingSaves.push(reply);
    return reply;
  }
}

function createStore(
  gateway: FakeTransactionsGateway = new FakeTransactionsGateway(),
  references = new FakeFinanceReferencesGateway(),
): { store: TransactionsStore; gateway: FakeTransactionsGateway; errors: RecordingErrorHandler } {
  const errors = new RecordingErrorHandler();
  TestBed.configureTestingModule({
    providers: [
      { provide: TransactionsGateway, useValue: gateway },
      { provide: FinanceReferencesGateway, useValue: references },
      { provide: Clock, useValue: new FixedClock(HALLOWEEN) },
      { provide: IdGenerator, useValue: new SequentialIdGenerator() },
      { provide: ErrorHandler, useValue: errors },
    ],
  });
  return { store: TestBed.inject(TransactionsStore), gateway, errors };
}

function ids(store: TransactionsStore): string[] {
  return store.transactions().map((transaction) => transaction.id);
}

describe('TransactionsStore loading', () => {
  it('loads the current month, the categories and the accounts', () => {
    const { store, gateway } = createStore();

    expect([gateway.askedMonths, ids(store), store.accounts().length, store.isLoaded()]).toEqual([
      ['2026-10'],
      ['groceries', 'pharmacy', 'salary'],
      2,
      true,
    ]);
  });

  it('offers to try again after a failed load, then loads what was missing', () => {
    const references = new FakeFinanceReferencesGateway();
    references.failure = new Error('offline');
    const { store, errors } = createStore(new FakeTransactionsGateway(), references);
    const failed = store.hasLoadFailed();

    references.failure = undefined;
    store.reload();

    expect([failed, errors.errors.length, store.hasLoadFailed(), store.isLoaded()]).toEqual([
      true,
      2,
      false,
      true,
    ]);
  });

  it('shows another month once it arrives', () => {
    const { store } = createStore();

    store.showMonth('2026-09');

    expect([store.month(), ids(store), store.isLoaded()]).toEqual(['2026-09', [], true]);
  });

  it('ignores the answer for a month no longer shown', () => {
    const gateway = new ControlledListTransactionsGateway();
    const { store } = createStore(gateway);
    store.showMonth('2026-09');

    gateway.pendingLists.get('2026-10')!.next(SAMPLE_OCTOBER);

    expect([ids(store), store.isLoaded()]).toEqual([[], false]);
  });
});

describe('TransactionsStore writes', () => {
  it('adds a transaction at the top of the list and saves it', () => {
    const { store, gateway } = createStore();

    const added = store.add(FUEL);

    expect([ids(store)[0], gateway.saved, store.lastAccountId()]).toEqual([
      added.id,
      [added],
      'credit-card',
    ]);
  });

  it('saves a transaction of another month without showing it', () => {
    const { store, gateway } = createStore();

    store.add({ ...FUEL, date: '2026-11-02' });

    expect([ids(store).length, gateway.saved.length]).toEqual([3, 1]);
  });

  it('drops an added transaction the gateway rejects', () => {
    const { store, gateway, errors } = createStore();
    gateway.failure = new Error('offline');

    store.add(FUEL);

    expect([ids(store), errors.errors.length]).toEqual([['groceries', 'pharmacy', 'salary'], 1]);
  });

  it('edits a transaction in place', () => {
    const { store } = createStore();

    store.update('pharmacy', { ...PHARMACY, amountCents: -6000 });

    expect(store.transactions()[1]).toEqual({ ...PHARMACY, amountCents: -6000 });
  });

  it('takes a transaction moved to another month out of the list', () => {
    const { store } = createStore();

    store.update('pharmacy', { ...PHARMACY, date: '2026-11-01' });

    expect(ids(store)).toEqual(['groceries', 'salary']);
  });

  it('puts the previous version back when an edit is rejected', () => {
    const { store, gateway } = createStore();
    gateway.failure = new Error('offline');

    store.update('pharmacy', { ...PHARMACY, date: '2026-11-01' });

    expect(store.transactions()).toEqual(SAMPLE_OCTOBER);
  });

  it('keeps a newer edit when an older one fails late', () => {
    const gateway = new ControlledSaveTransactionsGateway();
    const { store } = createStore(gateway);
    store.update('groceries', { ...GROCERIES, description: 'Market' });
    store.update('groceries', { ...GROCERIES, description: 'Supermarket' });

    gateway.pendingSaves[0].error(new Error('offline'));

    expect(store.transactions()[0].description).toBe('Supermarket');
  });

  it('deletes a transaction and puts it back in place if the gateway rejects it', () => {
    const { store, gateway } = createStore();
    store.delete('salary');
    const afterDelete = ids(store);

    gateway.failure = new Error('offline');
    store.delete('pharmacy');

    expect([afterDelete, ids(store), gateway.deleted]).toEqual([
      ['groceries', 'pharmacy'],
      ['groceries', 'pharmacy'],
      ['salary', 'pharmacy'],
    ]);
  });
});

describe('TransactionsStore import', () => {
  const IMPORTED: Transaction = { ...GROCERIES, id: 'bank-1', description: 'Imported' };

  it('finds which of the ids are already stored in the given months', async () => {
    const { store } = createStore();

    expect(await store.storedIds(['2026-10', '2026-09'])).toEqual(
      new Set(['groceries', 'pharmacy', 'salary']),
    );
  });

  it('lists the transactions stored in the given months', async () => {
    const { store } = createStore();

    const stored = await store.inMonths(['2026-10', '2026-09']);

    expect(stored.map((transaction) => transaction.id)).toEqual([
      'groceries',
      'pharmacy',
      'salary',
    ]);
  });

  it('saves every transaction of an import and reads the month again', async () => {
    const { store, gateway } = createStore();
    const second = { ...IMPORTED, id: 'bank-2' };

    const result = await store.addAll([IMPORTED, second]);

    expect([
      result,
      gateway.saved.map((transaction) => transaction.id),
      gateway.askedMonths,
    ]).toEqual([{ saved: 2, failed: 0 }, ['bank-1', 'bank-2'], ['2026-10', '2026-10']]);
  });

  it('counts and reports a transaction the gateway refuses, without stopping the others', async () => {
    const { store, gateway, errors } = createStore();
    gateway.failure = new Error('offline');

    const result = await store.addAll([IMPORTED, { ...IMPORTED, id: 'bank-2' }]);

    expect(result).toEqual({ saved: 0, failed: 2 });
    // One report per refused save, and one more for the month that could not be read again.
    expect(errors.errors.length).toBe(3);
  });
});
