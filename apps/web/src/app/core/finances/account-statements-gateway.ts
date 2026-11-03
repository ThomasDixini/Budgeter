import { Observable } from 'rxjs';
import { AccountStatement, CardPayment } from './account-statement';

/**
 * Port to where account balances are worked out and card invoice payments are stored. `app.config.ts`
 * binds it to the HTTP adapter and tests to a fake.
 */
export abstract class AccountStatementsGateway {
  /** Where every account stands on a `YYYY-MM-DD` day, in account creation order. */
  abstract statements(asOf: string): Observable<readonly AccountStatement[]>;

  /** The card payments of a `YYYY-MM` month, newest day first. */
  abstract paymentsInMonth(month: string): Observable<readonly CardPayment[]>;

  /** Records or replaces a card payment; answers with the stored version. */
  abstract savePayment(payment: CardPayment): Observable<CardPayment>;

  /** Deletes a card payment; deleting one already gone succeeds. */
  abstract deletePayment(paymentId: string): Observable<void>;
}
