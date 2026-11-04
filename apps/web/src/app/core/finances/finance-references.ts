/** Where money is kept: a bank account holds a balance, a credit card builds up an invoice. */
export type AccountKind = 'bankAccount' | 'creditCard';

/** A bank account or credit card that transactions are paid from or received into. */
export interface Account {
  readonly id: string;
  readonly name: string;
  readonly kind: AccountKind;
}

/** What money went to or came from (food, salary…); separate from the routines categories. */
export interface FinanceCategory {
  readonly id: string;
  readonly name: string;
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
