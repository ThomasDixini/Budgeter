/** R$ 10 million in cents, the largest amount the API accepts for one transaction. */
export const MAX_AMOUNT_CENTS = 1_000_000_000;

const CENTS_PER_REAL = 100;
const CURRENCY = 'BRL';
/** Typed amounts: whole reais with up to 2 decimals after a comma or a dot, no thousands separators. */
const AMOUNT_PATTERN = /^(\d{1,8})(?:[.,](\d{1,2}))?$/;
/** U+2212, the typographic minus: a hyphen reads as a dash next to "R$". */
const MINUS_SIGN = '−';

/**
 * An amount in reais without sign, in the given locale.
 * @example formatMoney(-28640, 'en-US') // 'R$286.40'
 */
export function formatMoney(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: CURRENCY }).format(
    Math.abs(cents) / CENTS_PER_REAL,
  );
}

/**
 * An amount in reais with a leading plus (income, or zero) or minus (expense).
 * @example formatSignedMoney(-28640, 'en-US') // '−R$286.40'
 */
export function formatSignedMoney(cents: number, locale: string): string {
  return `${cents < 0 ? MINUS_SIGN : '+'}${formatMoney(cents, locale)}`;
}

/**
 * Reads an amount typed by the user as cents; undefined when it is not shaped like `286,40` or
 * `286.4`. Zero is read as 0: whether it is acceptable is the caller's rule.
 * @example parseAmountCents('286,4') // 28640
 */
export function parseAmountCents(text: string): number | undefined {
  const match = AMOUNT_PATTERN.exec(text.trim());
  if (match === null) return undefined;
  const fraction = (match[2] ?? '').padEnd(2, '0');
  return Number(match[1]) * CENTS_PER_REAL + Number(fraction);
}

/**
 * Whether a typed amount can be saved: read, above zero and within the API's limit.
 * @example isValidAmount(parseAmountCents('0,00')) // false
 */
export function isValidAmount(cents: number | undefined): cents is number {
  return cents !== undefined && cents > 0 && cents <= MAX_AMOUNT_CENTS;
}

/**
 * Cents written back as an editable amount, the way `parseAmountCents` reads it.
 * @example amountText(-28640) // '286.40'
 */
export function amountText(cents: number): string {
  return (Math.abs(cents) / CENTS_PER_REAL).toFixed(2);
}
