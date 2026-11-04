/** Whether money came in or went out; the sign of the amount carries it. */
export type TransactionType = 'income' | 'expense';

/** Money that came into (positive) or went out of (negative) an account on a day. */
export interface Transaction {
  readonly id: string;
  /** Local calendar day, `YYYY-MM-DD`. */
  readonly date: string;
  readonly description: string;
  readonly categoryId: string;
  readonly accountId: string;
  /** Signed amount in cents: positive is income, negative is an expense; never zero. */
  readonly amountCents: number;
}

/** What the transaction form fills in; the id is given by the store. */
export type TransactionDraft = Omit<Transaction, 'id'>;

/** Choices of the income/expense switch, in display order. */
export const TRANSACTION_TYPE_OPTIONS: readonly { value: TransactionType; label: string }[] = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
];

/**
 * Whether a transaction brought money in.
 * @example typeOf({ ...salary, amountCents: 950000 }) // 'income'
 */
export function typeOf(transaction: Pick<Transaction, 'amountCents'>): TransactionType {
  return transaction.amountCents > 0 ? 'income' : 'expense';
}

/**
 * The signed amount for a positive value typed by the user.
 * @example signedCents(28640, 'expense') // -28640
 */
export function signedCents(unsignedCents: number, type: TransactionType): number {
  return type === 'income' ? unsignedCents : -unsignedCents;
}
