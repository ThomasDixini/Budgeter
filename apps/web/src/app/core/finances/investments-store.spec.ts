import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Clock } from '../calendar/clock';
import { FixedClock } from '../calendar/fixed-clock';
import { IdGenerator } from '../ids/id-generator';
import { SequentialIdGenerator } from '../ids/sequential-id-generator';
import { FakeInvestmentsGateway } from './fake-investments-gateway';
import { TradeDraft } from './investments';
import { InvestmentsGateway } from './investments-gateway';
import { InvestmentsStore } from './investments-store';

/** Tuesday, November 3, 2026. */
const NOW = new Date(2026, 10, 3, 9, 0);

const BUY_MORE: TradeDraft = {
  investmentId: 'petr4',
  date: '2026-11-03',
  kind: 'buy',
  quantityThousandths: 10000,
  unitPriceCents: 1200,
};

/** Records reported errors instead of logging them. */
class RecordingErrorHandler extends ErrorHandler {
  readonly errors: unknown[] = [];

  override handleError(error: unknown): void {
    this.errors.push(error);
  }
}

function createStore(gateway = new FakeInvestmentsGateway()) {
  const errors = new RecordingErrorHandler();
  TestBed.configureTestingModule({
    providers: [
      InvestmentsStore,
      { provide: InvestmentsGateway, useValue: gateway },
      { provide: Clock, useValue: new FixedClock(NOW) },
      { provide: IdGenerator, useValue: new SequentialIdGenerator() },
      { provide: ErrorHandler, useValue: errors },
    ],
  });
  return { store: TestBed.inject(InvestmentsStore), gateway, errors };
}

describe('InvestmentsStore loading', () => {
  it("asks for today's portfolio and lists its movements newest first", async () => {
    const { store, gateway } = createStore();
    await Promise.resolve();

    expect(gateway.askedDays).toEqual(['2026-11-03']);
    expect(store.isLoaded()).toBe(true);
    expect(store.movements().map((item) => item.id)).toEqual([
      'dividend-petr4',
      'buy-xpml11',
      'buy-petr4',
    ]);
  });

  it('offers to try again when the portfolio does not arrive', async () => {
    const gateway = new FakeInvestmentsGateway();
    gateway.failure = new Error('offline');
    const { store, errors } = createStore(gateway);
    await Promise.resolve();
    gateway.failure = undefined;

    store.reload();
    await Promise.resolve();

    expect([errors.errors.length, store.hasLoadFailed(), store.isLoaded()]).toEqual([
      1,
      false,
      true,
    ]);
  });
});

describe('InvestmentsStore changes', () => {
  it('sends a trade with a new id and reads the portfolio again once it is stored', async () => {
    const { store, gateway } = createStore();

    const stored = await store.addTrade(BUY_MORE);

    expect([stored, gateway.savedTrades, gateway.askedDays.length]).toEqual([
      true,
      [{ id: 'id-1', draft: BUY_MORE }],
      2,
    ]);
  });

  it('reports a refused change, says it was not stored and does not read again', async () => {
    const { store, gateway, errors } = createStore();
    await Promise.resolve();
    gateway.failure = new Error('Expected a sale of at most 100 units');

    const stored = await store.addTrade({ ...BUY_MORE, kind: 'sell' });

    expect([stored, errors.errors.length, gateway.askedDays.length, store.isSaving()]).toEqual([
      false,
      1,
      1,
      false,
    ]);
  });

  it('keeps the id of an investment being edited and gives a new one otherwise', async () => {
    const { store, gateway } = createStore();

    await store.saveInvestment('petr4', { name: 'PETR4', kind: 'stock' });
    await store.saveInvestment(undefined, { name: 'ITSA4', kind: 'stock' });

    expect(gateway.savedInvestments.map((request) => request.id)).toEqual(['petr4', 'id-1']);
  });

  it('deletes trades, proventos and investments through the gateway', async () => {
    const { store, gateway } = createStore();

    await store.deleteTrade('buy-petr4');
    await store.deleteIncome('dividend-petr4');
    await store.deleteInvestment('xpml11');

    expect([gateway.deletedTrades, gateway.deletedIncomes, gateway.deletedInvestments]).toEqual([
      ['buy-petr4'],
      ['dividend-petr4'],
      ['xpml11'],
    ]);
  });
});
