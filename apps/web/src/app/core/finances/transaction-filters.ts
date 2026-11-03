import { Transaction, TransactionType, typeOf } from './transaction';

/** Which side of the money the list shows. */
export type TypeFilter = 'all' | TransactionType;

/** What narrows the transactions list; every filter applies at once. */
export interface TransactionFilters {
  readonly type: TypeFilter;
  /** Only this account's transactions; undefined shows every account. */
  readonly accountId: string | undefined;
  /** Text searched in the description and the category name. */
  readonly query: string;
}

export const NO_FILTERS: TransactionFilters = { type: 'all', accountId: undefined, query: '' };

/** Choices of the type filter, in display order. */
export const TYPE_FILTER_OPTIONS: readonly { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expenses' },
];

/**
 * The transactions that pass every filter, in their original order.
 * @example filterTransactions(october, { ...NO_FILTERS, query: 'farmacia' }, categoryNames)
 */
export function filterTransactions(
  transactions: readonly Transaction[],
  filters: TransactionFilters,
  categoryNames: ReadonlyMap<string, string>,
): Transaction[] {
  const query = searchKey(filters.query.trim());
  return transactions.filter(
    (transaction) =>
      (filters.type === 'all' || typeOf(transaction) === filters.type) &&
      (filters.accountId === undefined || transaction.accountId === filters.accountId) &&
      matchesQuery(transaction, query, categoryNames),
  );
}

/**
 * Text folded for searching: lower case, without accents, so "farmacia" finds "Farmácia".
 * @example searchKey('Farmácia') // 'farmacia'
 */
export function searchKey(text: string): string {
  return text
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function matchesQuery(
  transaction: Transaction,
  query: string,
  categoryNames: ReadonlyMap<string, string>,
): boolean {
  if (query === '') return true;
  const category = categoryNames.get(transaction.categoryId) ?? '';
  return searchKey(`${transaction.description} ${category}`).includes(query);
}
