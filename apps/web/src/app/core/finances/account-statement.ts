/** One invoice of a credit card: purchases dated from `startsOn` up to the day before `closesOn`. */
export interface Invoice {
  /** Local calendar days, `YYYY-MM-DD`. */
  readonly startsOn: string;
  readonly closesOn: string;
  readonly dueOn: string;
  /** What was spent on it so far (purchases minus refunds), in cents. */
  readonly amountCents: number;
}

/** Where a credit card stands: the limit left, what is owed from closed invoices, and its invoices. */
export interface CardStatement {
  readonly availableLimitCents: number;
  /** Still owed from invoices that already closed; 0 when they are paid. */
  readonly amountDueCents: number;
  /** The invoice purchases go to today. */
  readonly openInvoice: Invoice;
  /** The invoice that closed last. */
  readonly closedInvoice: Invoice;
}

/**
 * Where an account stands today. A bank account's balance is what it holds; a credit card's is minus
 * what is owed on it.
 */
export interface AccountStatement {
  readonly accountId: string;
  readonly balanceCents: number;
  /** Present on credit cards only. */
  readonly card?: CardStatement;
}

/**
 * Money moved from a bank account to a credit card to pay its invoice. Neither income nor an expense:
 * the purchases on the card already counted as expenses.
 */
export interface CardPayment {
  readonly id: string;
  readonly cardId: string;
  readonly fromAccountId: string;
  /** Local calendar day, `YYYY-MM-DD`. */
  readonly date: string;
  /** Always above zero. */
  readonly amountCents: number;
}

/** What the payment form fills in; the id is given by the store. */
export type CardPaymentDraft = Omit<CardPayment, 'id'>;

/**
 * What to offer paying: what is still due from closed invoices, or else the open invoice.
 * @example suggestedPaymentCents({ ...card, amountDueCents: 0, openInvoice: { ...invoice, amountCents: 28640 } }) // 28640
 */
export function suggestedPaymentCents(card: CardStatement): number {
  return card.amountDueCents > 0 ? card.amountDueCents : Math.max(0, card.openInvoice.amountCents);
}
