import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Clock } from '../calendar/clock';
import { FixedClock } from '../calendar/fixed-clock';
import { IdGenerator } from '../ids/id-generator';
import { SequentialIdGenerator } from '../ids/sequential-id-generator';
import { CardPayment } from './account-statement';
import { AccountStatementsGateway } from './account-statements-gateway';
import { FakeAccountStatementsGateway, SAMPLE_PAYMENT } from './fake-account-statements-gateway';
import {
  FakeFinanceReferencesGateway,
  FakeTransactionsGateway,
  SAMPLE_OCTOBER,
} from './fake-finances-gateways';
import { StatementImportStore, monthsUpTo } from './statement-import-store';
import { FinanceReferencesGateway, TransactionsGateway } from './transactions-gateway';

/** Records reported errors instead of logging them. */
class RecordingErrorHandler extends ErrorHandler {
  readonly errors: unknown[] = [];

  override handleError(error: unknown): void {
    this.errors.push(error);
  }
}

const PAYMENT: CardPayment = {
  ...SAMPLE_PAYMENT,
  id: 'bank-payment',
  date: '2026-10-07',
  amountCents: 206428,
};

function createStore(): {
  store: StatementImportStore;
  transactions: FakeTransactionsGateway;
  statements: FakeAccountStatementsGateway;
  errors: RecordingErrorHandler;
} {
  const transactions = new FakeTransactionsGateway();
  const statements = new FakeAccountStatementsGateway();
  const errors = new RecordingErrorHandler();
  TestBed.configureTestingModule({
    providers: [
      { provide: TransactionsGateway, useValue: transactions },
      { provide: AccountStatementsGateway, useValue: statements },
      { provide: FinanceReferencesGateway, useValue: new FakeFinanceReferencesGateway() },
      { provide: Clock, useValue: new FixedClock(new Date(2026, 9, 31, 20, 0)) },
      { provide: IdGenerator, useValue: new SequentialIdGenerator() },
      { provide: ErrorHandler, useValue: errors },
    ],
  });
  return { store: TestBed.inject(StatementImportStore), transactions, statements, errors };
}

describe('monthsUpTo', () => {
  it('lists the months ending at the given one, across a year change', () => {
    expect(monthsUpTo('2026-02', 3)).toEqual(['2025-12', '2026-01', '2026-02']);
  });
});

describe('StatementImportStore', () => {
  it('learns the category of a description from the months before the statement', async () => {
    const { store, transactions } = createStore();

    const memory = await store.categoryMemory('2026-10', 3);

    expect(memory.get('out|farmacia')).toBe('health');
    expect(transactions.askedMonths).toEqual(expect.arrayContaining(['2026-08', '2026-09']));
  });

  it('finds the transactions and the card payments already stored in the months', async () => {
    const { store } = createStore();

    expect(await store.storedIds(['2026-10'])).toEqual(
      new Set([...SAMPLE_OCTOBER.map((transaction) => transaction.id), SAMPLE_PAYMENT.id]),
    );
  });

  it('saves the transactions and the payments and counts them together', async () => {
    const { store, transactions, statements } = createStore();

    const result = await store.importAll({
      transactions: [{ ...SAMPLE_OCTOBER[0], id: 'bank-1' }],
      payments: [PAYMENT],
    });

    expect([
      result,
      transactions.saved.map((item) => item.id),
      statements.savedPayments.map((item) => item.id),
    ]).toEqual([{ saved: 2, failed: 0 }, ['bank-1'], ['bank-payment']]);
  });

  it('counts and reports a payment the gateway refuses, and keeps going', async () => {
    const { store, statements, errors } = createStore();
    statements.failure = new Error('offline');

    const result = await store.importAll({
      transactions: [],
      payments: [PAYMENT, { ...PAYMENT, id: 'bank-payment-2' }],
    });

    expect([result, errors.errors.length]).toEqual([{ saved: 0, failed: 2 }, 2]);
  });
});
