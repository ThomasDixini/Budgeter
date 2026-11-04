import { Observable } from 'rxjs';
import { Account, FinanceCategory } from './finance-references';
import { Transaction } from './transaction';

/**
 * Port to wherever transactions are stored. The store depends on this class only; `app.config.ts`
 * binds it to the HTTP adapter and tests to a fake.
 */
export abstract class TransactionsGateway {
  /** The transactions of a `YYYY-MM` month, newest day first and the latest added first within a day. */
  abstract listMonth(month: string): Observable<readonly Transaction[]>;

  /** Creates or replaces a transaction; answers with the stored (normalized) version. */
  abstract save(transaction: Transaction): Observable<Transaction>;

  /** Deletes a transaction; deleting one already gone succeeds. */
  abstract delete(transactionId: string): Observable<void>;
}

/** Port to what transactions refer to: their categories and accounts. */
export abstract class FinanceReferencesGateway {
  /** Every finance category, ordered by name. */
  abstract categories(): Observable<readonly FinanceCategory[]>;

  /** Every bank account and credit card, in creation order. */
  abstract accounts(): Observable<readonly Account[]>;
}
