import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { Clock } from '../calendar/clock';
import { FixedClock } from '../calendar/fixed-clock';
import { IdGenerator } from '../ids/id-generator';
import { SequentialIdGenerator } from '../ids/sequential-id-generator';
import { AccountStatement, CardPaymentDraft } from './account-statement';
import { AccountStatementsGateway } from './account-statements-gateway';
import { BanksAndCardsStore } from './banks-and-cards-store';
import {
  FakeAccountStatementsGateway,
  SAMPLE_PAYMENT,
  SAMPLE_STATEMENTS,
} from './fake-account-statements-gateway';
import { FakeFinanceReferencesGateway, FakeTransactionsGateway } from './fake-finances-gateways';
import { FinanceReferencesGateway, TransactionsGateway } from './transactions-gateway';

/** Saturday, October 31, 2026. */
const HALLOWEEN = new Date(2026, 9, 31, 20, 0);

const PAY_OCTOBER_INVOICE: CardPaymentDraft = {
  cardId: 'credit-card',
  fromAccountId: 'checking-account',
  date: '2026-10-31',
  amountCents: 28640,
};

/** Records reported errors instead of logging them. */
class RecordingErrorHandler extends ErrorHandler {
  readonly errors: unknown[] = [];

  override handleError(error: unknown): void {
    this.errors.push(error);
  }
}

/** Statement requests that stay open until a test answers them, to play out reordered replies. */
class ControlledStatementsGateway extends FakeAccountStatementsGateway {
  readonly pendingStatements: Subject<readonly AccountStatement[]>[] = [];

  override statements(asOf: string): Observable<readonly AccountStatement[]> {
    this.askedStatements.push(asOf);
    const reply = new Subject<readonly AccountStatement[]>();
    this.pendingStatements.push(reply);
    return reply;
  }
}

function createStore(
  gateway: FakeAccountStatementsGateway = new FakeAccountStatementsGateway(),
  transactions = new FakeTransactionsGateway(),
): { store: BanksAndCardsStore; errors: RecordingErrorHandler } {
  const errors = new RecordingErrorHandler();
  TestBed.configureTestingModule({
    providers: [
      BanksAndCardsStore,
      { provide: AccountStatementsGateway, useValue: gateway },
      { provide: TransactionsGateway, useValue: transactions },
      { provide: FinanceReferencesGateway, useValue: new FakeFinanceReferencesGateway() },
      { provide: Clock, useValue: new FixedClock(HALLOWEEN) },
      { provide: IdGenerator, useValue: new SequentialIdGenerator() },
      { provide: ErrorHandler, useValue: errors },
    ],
  });
  return { store: TestBed.inject(BanksAndCardsStore), errors };
}

describe('BanksAndCardsStore loading', () => {
  it("loads today's statements, the months around this one and this month's payments", () => {
    const gateway = new FakeAccountStatementsGateway();
    const transactions = new FakeTransactionsGateway();
    const { store } = createStore(gateway, transactions);

    expect([
      gateway.askedStatements,
      transactions.askedMonths,
      store.transactions().length,
      store.payments(),
      store.statements().get('checking-account')?.balanceCents,
      store.isLoaded(),
    ]).toEqual([
      ['2026-10-31'],
      ['2026-09', '2026-10', '2026-11'],
      3,
      [SAMPLE_PAYMENT],
      1002860,
      true,
    ]);
  });

  it('offers to try again after a failed load, then loads what was missing', () => {
    const gateway = new FakeAccountStatementsGateway();
    gateway.failure = new Error('offline');
    const { store } = createStore(gateway);
    const failed = store.hasLoadFailed();

    gateway.failure = undefined;
    store.reload();

    expect([failed, store.hasLoadFailed(), store.isLoaded()]).toEqual([true, false, true]);
  });
});

describe('BanksAndCardsStore payments', () => {
  it('lists a payment at once and asks for the balances again once it is stored', () => {
    const gateway = new FakeAccountStatementsGateway();
    const { store } = createStore(gateway);

    store.payInvoice(PAY_OCTOBER_INVOICE);

    expect([store.payments().map((payment) => payment.id), gateway.askedStatements.length]).toEqual(
      [['id-1', SAMPLE_PAYMENT.id], 2],
    );
  });

  it('does not list a payment dated in another month', () => {
    const { store } = createStore();

    store.payInvoice({ ...PAY_OCTOBER_INVOICE, date: '2026-11-10' });

    expect(store.payments()).toEqual([SAMPLE_PAYMENT]);
  });

  it('drops a payment the gateway rejects and reports it', () => {
    const gateway = new FakeAccountStatementsGateway();
    const { store, errors } = createStore(gateway);
    gateway.failure = new Error('offline');

    store.payInvoice(PAY_OCTOBER_INVOICE);

    expect([store.payments(), errors.errors.length]).toEqual([[SAMPLE_PAYMENT], 1]);
  });

  it('deletes a payment and puts it back if the gateway rejects it', () => {
    const gateway = new FakeAccountStatementsGateway();
    const { store } = createStore(gateway);
    gateway.failure = new Error('offline');

    store.deletePayment(SAMPLE_PAYMENT.id);

    expect([store.payments(), gateway.deletedPayments]).toEqual([
      [SAMPLE_PAYMENT],
      [SAMPLE_PAYMENT.id],
    ]);
  });
});

describe('BanksAndCardsStore balances', () => {
  it('asks for the balances again once an account change is stored', () => {
    const gateway = new FakeAccountStatementsGateway();
    const { store } = createStore(gateway);

    store.addAccount({ name: 'Nubank', kind: 'bankAccount', openingBalanceCents: 0 });

    expect([store.accounts().length, gateway.askedStatements.length]).toEqual([3, 2]);
  });

  it('keeps the newest balances when an older answer comes late', () => {
    const gateway = new ControlledStatementsGateway();
    const { store } = createStore(gateway);
    store.deletePayment(SAMPLE_PAYMENT.id);
    const newer = [{ accountId: 'checking-account', balanceCents: 1 }];

    gateway.pendingStatements[1].next(newer);
    gateway.pendingStatements[0].next(SAMPLE_STATEMENTS);

    expect(store.statements().get('checking-account')?.balanceCents).toBe(1);
  });
});
