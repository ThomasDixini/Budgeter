import {
  bankAccountDraft,
  cardTermsFrom,
  creditCardDraft,
  openingBalanceCents,
  parseDayOfMonth,
} from './account-drafts';
import { MAX_AMOUNT_CENTS } from './money';

const TERMS = { limitCents: 500000, closingDay: 3, dueDay: 10 };

describe('parseDayOfMonth', () => {
  it('reads a day from 1 to 31', () => {
    expect([parseDayOfMonth('1'), parseDayOfMonth(' 31 '), parseDayOfMonth('03')]).toEqual([
      1, 31, 3,
    ]);
  });

  it('refuses zero, days past 31 and anything but a whole number', () => {
    expect(['0', '32', '3.5', 'x', ''].map(parseDayOfMonth)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });
});

describe('openingBalanceCents', () => {
  it('reads blank as zero and keeps a negative balance', () => {
    expect([openingBalanceCents(' '), openingBalanceCents('-150')]).toEqual([0, -15000]);
  });

  it('refuses an unreadable balance or one past the limit', () => {
    expect([openingBalanceCents('abc'), openingBalanceCents(`-${MAX_AMOUNT_CENTS}`)]).toEqual([
      undefined,
      undefined,
    ]);
  });
});

describe('cardTermsFrom', () => {
  it('reads the limit and both days', () => {
    expect(cardTermsFrom('5000', '3', '10')).toEqual(TERMS);
  });

  it('refuses a zero limit or a missing day', () => {
    expect([cardTermsFrom('0', '3', '10'), cardTermsFrom('5000', '', '10')]).toEqual([
      undefined,
      undefined,
    ]);
  });
});

describe('bankAccountDraft', () => {
  it('trims the name and reads the balance', () => {
    expect(bankAccountDraft(' Nubank ', '150')).toEqual({
      name: 'Nubank',
      kind: 'bankAccount',
      openingBalanceCents: 15000,
    });
  });

  it('waits for a name', () => {
    expect(bankAccountDraft('  ', '150')).toBeUndefined();
  });
});

describe('creditCardDraft', () => {
  it('gives a card no opening balance', () => {
    expect(creditCardDraft('Visa', TERMS)).toEqual({
      name: 'Visa',
      kind: 'creditCard',
      openingBalanceCents: 0,
      card: TERMS,
    });
  });

  it('waits for complete terms', () => {
    expect(creditCardDraft('Visa', undefined)).toBeUndefined();
  });
});
