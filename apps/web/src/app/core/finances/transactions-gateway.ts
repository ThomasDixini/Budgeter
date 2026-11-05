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

  /** Creates or renames a finance category; answers with the stored version. */
  abstract saveCategory(category: FinanceCategory): Observable<FinanceCategory>;

  /** Deletes a finance category nothing was recorded under; deleting one already gone succeeds. */
  abstract deleteCategory(categoryId: string): Observable<void>;

  /** Every bank account and credit card, in creation order. */
  abstract accounts(): Observable<readonly Account[]>;

  /** Creates or replaces an account; answers with the stored (normalized) version. */
  abstract saveAccount(account: Account): Observable<Account>;

  /** Deletes an account nothing was recorded on; deleting one already gone succeeds. */
  abstract deleteAccount(accountId: string): Observable<void>;
}
