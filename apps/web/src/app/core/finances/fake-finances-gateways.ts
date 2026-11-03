import { Observable, of, throwError } from 'rxjs';
import { Account, FinanceCategory } from './finance-references';
import { Transaction } from './transaction';
import { FinanceReferencesGateway, TransactionsGateway } from './transactions-gateway';

export const SAMPLE_FINANCE_CATEGORIES: readonly FinanceCategory[] = [
  { id: 'food', name: 'Food' },
  { id: 'health', name: 'Health' },
  { id: 'salary', name: 'Salary' },
];

export const SAMPLE_ACCOUNTS: readonly Account[] = [
  {
    id: 'checking-account',
    name: 'Checking account',
    kind: 'bankAccount',
    openingBalanceCents: 100000,
  },
  {
    id: 'credit-card',
    name: 'Credit card',
    kind: 'creditCard',
    openingBalanceCents: 0,
    card: { limitCents: 500000, closingDay: 3, dueDay: 10 },
  },
];

/** October 2026, newest first as the API answers: a salary, groceries and a pharmacy purchase. */
export const SAMPLE_OCTOBER: readonly Transaction[] = [
  {
    id: 'groceries',
    date: '2026-10-31',
    description: 'Groceries',
    categoryId: 'food',
    accountId: 'credit-card',
    amountCents: -28640,
  },
  {
    id: 'pharmacy',
    date: '2026-10-27',
    description: 'Farmácia',
    categoryId: 'health',
    accountId: 'checking-account',
    amountCents: -5890,
  },
  {
    id: 'salary',
    date: '2026-10-05',
    description: 'Salary',
    categoryId: 'salary',
    accountId: 'checking-account',
    amountCents: 950000,
  },
];

/** Test double answering synchronously from memory; set `failure` to make the next calls fail. */
export class FakeTransactionsGateway extends TransactionsGateway {
  failure: Error | undefined;
  readonly saved: Transaction[] = [];
  readonly deleted: string[] = [];
  /** Months `listMonth` was asked for, in order. */
  readonly askedMonths: string[] = [];

  constructor(
    private readonly months: ReadonlyMap<string, readonly Transaction[]> = new Map([
      ['2026-10', SAMPLE_OCTOBER],
    ]),
  ) {
    super();
  }

  override listMonth(month: string): Observable<readonly Transaction[]> {
    this.askedMonths.push(month);
    return this.answer(this.months.get(month) ?? []);
  }

  override save(transaction: Transaction): Observable<Transaction> {
    this.saved.push(transaction);
    return this.answer(transaction);
  }

  override delete(transactionId: string): Observable<void> {
    this.deleted.push(transactionId);
    return this.answer(undefined);
  }

  private answer<TValue>(value: TValue): Observable<TValue> {
    return this.failure === undefined ? of(value) : throwError(() => this.failure);
  }
}

/** Test double serving the sample categories and accounts; set `failure` to make the next calls fail. */
export class FakeFinanceReferencesGateway extends FinanceReferencesGateway {
  failure: Error | undefined;
  readonly savedAccounts: Account[] = [];
  readonly deletedAccounts: string[] = [];

  override categories(): Observable<readonly FinanceCategory[]> {
    return this.answer(SAMPLE_FINANCE_CATEGORIES);
  }

  override accounts(): Observable<readonly Account[]> {
    return this.answer(SAMPLE_ACCOUNTS);
  }

  override saveAccount(account: Account): Observable<Account> {
    this.savedAccounts.push(account);
    return this.answer(account);
  }

  override deleteAccount(accountId: string): Observable<void> {
    this.deletedAccounts.push(accountId);
    return this.answer(undefined);
  }

  private answer<TValue>(value: TValue): Observable<TValue> {
    return this.failure === undefined ? of(value) : throwError(() => this.failure);
  }
}
