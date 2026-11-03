import { AccountDraft, CardTerms } from './finance-references';
import { MAX_AMOUNT_CENTS, isValidAmount, parseAmountCents, parseSignedAmountCents } from './money';

/** The last day a card can close or be due on; later days of short months fall on their last day. */
export const LAST_DAY_OF_MONTH = 31;

const DAY_PATTERN = /^\d{1,2}$/;

/**
 * Reads a day of the month typed by the user; undefined unless it is a whole number from 1 to 31.
 * @example parseDayOfMonth('03') // 3
 */
export function parseDayOfMonth(text: string): number | undefined {
  const trimmed = text.trim();
  if (!DAY_PATTERN.test(trimmed)) return undefined;
  const day = Number(trimmed);
  return day >= 1 && day <= LAST_DAY_OF_MONTH ? day : undefined;
}

/**
 * Reads a typed opening balance: blank is zero, and a negative (overdrawn) balance is allowed within
 * the API's limit. Undefined when it cannot be read.
 * @example openingBalanceCents('-150,00') // -15000
 */
export function openingBalanceCents(text: string): number | undefined {
  if (text.trim() === '') return 0;
  const cents = parseSignedAmountCents(text);
  return cents !== undefined && Math.abs(cents) <= MAX_AMOUNT_CENTS ? cents : undefined;
}

/**
 * Reads typed card terms; undefined unless the limit is above zero and both days are 1–31.
 * @example cardTermsFrom('5000', '3', '10') // { limitCents: 500000, closingDay: 3, dueDay: 10 }
 */
export function cardTermsFrom(
  limitText: string,
  closingDayText: string,
  dueDayText: string,
): CardTerms | undefined {
  const limitCents = parseAmountCents(limitText);
  const closingDay = parseDayOfMonth(closingDayText);
  const dueDay = parseDayOfMonth(dueDayText);
  if (!isValidAmount(limitCents) || closingDay === undefined || dueDay === undefined) {
    return undefined;
  }
  return { limitCents, closingDay, dueDay };
}

/**
 * A bank account ready to save, or undefined while the name is blank or the balance unreadable.
 * @example bankAccountDraft(' Nubank ', '150') // { name: 'Nubank', kind: 'bankAccount', openingBalanceCents: 15000 }
 */
export function bankAccountDraft(name: string, balanceText: string): AccountDraft | undefined {
  const balance = openingBalanceCents(balanceText);
  if (name.trim() === '' || balance === undefined) return undefined;
  return { name: name.trim(), kind: 'bankAccount', openingBalanceCents: balance };
}

/**
 * A credit card ready to save, or undefined while the name is blank or the terms incomplete.
 * @example creditCardDraft('Visa', { limitCents: 500000, closingDay: 3, dueDay: 10 })
 */
export function creditCardDraft(
  name: string,
  card: CardTerms | undefined,
): AccountDraft | undefined {
  if (name.trim() === '' || card === undefined) return undefined;
  return { name: name.trim(), kind: 'creditCard', openingBalanceCents: 0, card };
}
