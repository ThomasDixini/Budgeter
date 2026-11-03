import { Observable, of, throwError } from 'rxjs';
import { AccountStatement, CardPayment } from './account-statement';
import { AccountStatementsGateway } from './account-statements-gateway';

/** The October 10 payment of the credit card's September invoice, from the checking account. */
export const SAMPLE_PAYMENT: CardPayment = {
  id: 'september-invoice',
  cardId: 'credit-card',
  fromAccountId: 'checking-account',
  date: '2026-10-10',
  amountCents: 41250,
};

/**
 * Where the sample accounts stand on October 31, 2026: the checking account holds its opening
 * R$1,000.00 plus October's transactions minus the payment; the card owes the October 31 groceries,
 * on the invoice closing November 3.
 */
export const SAMPLE_STATEMENTS: readonly AccountStatement[] = [
  { accountId: 'checking-account', balanceCents: 1002860 },
  {
    accountId: 'credit-card',
    balanceCents: -28640,
    card: {
      availableLimitCents: 471360,
      amountDueCents: 0,
      openInvoice: {
        startsOn: '2026-10-03',
        closesOn: '2026-11-03',
        dueOn: '2026-11-10',
        amountCents: 28640,
      },
      closedInvoice: {
        startsOn: '2026-09-03',
        closesOn: '2026-10-03',
        dueOn: '2026-10-10',
        amountCents: 41250,
      },
    },
  },
];

/** Test double answering synchronously from memory; set `failure` to make the next calls fail. */
export class FakeAccountStatementsGateway extends AccountStatementsGateway {
  failure: Error | undefined;
  statementsToServe: readonly AccountStatement[] = SAMPLE_STATEMENTS;
  readonly savedPayments: CardPayment[] = [];
  readonly deletedPayments: string[] = [];
  /** Days `statements` was asked for, in order. */
  readonly askedStatements: string[] = [];

  constructor(
    private readonly paymentMonths: ReadonlyMap<string, readonly CardPayment[]> = new Map([
      ['2026-10', [SAMPLE_PAYMENT]],
    ]),
  ) {
    super();
  }

  override statements(asOf: string): Observable<readonly AccountStatement[]> {
    this.askedStatements.push(asOf);
    return this.answer(this.statementsToServe);
  }

  override paymentsInMonth(month: string): Observable<readonly CardPayment[]> {
    return this.answer(this.paymentMonths.get(month) ?? []);
  }

  override savePayment(payment: CardPayment): Observable<CardPayment> {
    this.savedPayments.push(payment);
    return this.answer(payment);
  }

  override deletePayment(paymentId: string): Observable<void> {
    this.deletedPayments.push(paymentId);
    return this.answer(undefined);
  }

  private answer<TValue>(value: TValue): Observable<TValue> {
    return this.failure === undefined ? of(value) : throwError(() => this.failure);
  }
}
