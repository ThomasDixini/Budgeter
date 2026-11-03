/** Where money is kept: a bank account holds a balance, a credit card builds up an invoice. */
export type AccountKind = 'bankAccount' | 'creditCard';

/**
 * How a credit card bills: its limit, the day each invoice closes and the day it is due. A purchase
 * made on the closing day already goes to the next invoice.
 */
export interface CardTerms {
  readonly limitCents: number;
  /** Day of the month, 1–31; a day past a short month's end falls on its last day. */
  readonly closingDay: number;
  /** Day of the month, 1–31. */
  readonly dueDay: number;
}

/** A bank account or credit card that transactions are paid from or received into. */
export interface Account {
  readonly id: string;
  readonly name: string;
  readonly kind: AccountKind;
  /** What a bank account held before the transactions recorded on it; always 0 on a credit card. */
  readonly openingBalanceCents: number;
  /** How a credit card bills; absent on a bank account. */
  readonly card?: CardTerms;
}

/** What the account form fills in; the id is given by the store. */
export type AccountDraft = Omit<Account, 'id'>;

/** What money went to or came from (food, salary…); separate from the routines categories. */
export interface FinanceCategory {
  readonly id: string;
  readonly name: string;
}

/** The longest category name the API accepts. */
export const MAX_CATEGORY_NAME_LENGTH = 40;

/**
 * Whether another category already has the name, ignoring case and the spaces around it: the API
 * refuses a repeated name, so the form can say so before sending it.
 * @example isCategoryNameTaken([{ id: 'food', name: 'Food' }], ' food ', 'meals') // true
 */
export function isCategoryNameTaken(
  categories: readonly FinanceCategory[],
  name: string,
  exceptId?: string,
): boolean {
  const wanted = name.trim().toLowerCase();
  return categories.some(
    (category) => category.id !== exceptId && category.name.trim().toLowerCase() === wanted,
  );
}

/** Choices of the bank account/credit card switch, in display order. */
export const ACCOUNT_KIND_OPTIONS: readonly { value: AccountKind; label: string }[] = [
  { value: 'bankAccount', label: 'Bank account' },
  { value: 'creditCard', label: 'Credit card' },
];

/**
 * The kind spelled out for a heading or a tile.
 * @example accountKindLabel('creditCard') // 'Credit card'
 */
export function accountKindLabel(kind: AccountKind): string {
  return kind === 'creditCard' ? 'Credit card' : 'Bank account';
}

/**
 * Names by id, for showing the category or account of a transaction.
 * @example namesById([{ id: 'food', name: 'Food' }]).get('food') // 'Food'
 */
export function namesById(
  records: readonly { readonly id: string; readonly name: string }[],
): ReadonlyMap<string, string> {
  return new Map(records.map((record) => [record.id, record.name]));
}
