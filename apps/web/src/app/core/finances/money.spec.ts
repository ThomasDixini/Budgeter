import {
  MAX_AMOUNT_CENTS,
  amountText,
  formatMoney,
  formatSignedMoney,
  isValidAmount,
  parseAmountCents,
} from './money';

describe('formatMoney', () => {
  it('shows reais without the sign', () => {
    expect(formatMoney(-28640, 'en-US')).toBe('R$286.40');
  });

  it('groups thousands', () => {
    expect(formatMoney(950000, 'en-US')).toBe('R$9,500.00');
  });
});

describe('formatSignedMoney', () => {
  it('marks an expense with a typographic minus', () => {
    expect(formatSignedMoney(-28640, 'en-US')).toBe('−R$286.40');
  });

  it('marks income and zero with a plus', () => {
    expect([formatSignedMoney(6420, 'en-US'), formatSignedMoney(0, 'en-US')]).toEqual([
      '+R$64.20',
      '+R$0.00',
    ]);
  });
});

describe('parseAmountCents', () => {
  it.each([
    ['286,40', 28640],
    ['286.4', 28640],
    [' 12 ', 1200],
    ['0,05', 5],
  ])('reads %j as %d cents', (text, cents) => {
    expect(parseAmountCents(text)).toBe(cents);
  });

  it.each(['', 'abc', '1.234,56', '12,345', '-10', '1e3'])('rejects %j', (text) => {
    expect(parseAmountCents(text)).toBeUndefined();
  });
});

describe('isValidAmount', () => {
  it('accepts an amount up to the limit', () => {
    expect(isValidAmount(MAX_AMOUNT_CENTS)).toBe(true);
  });

  it.each([undefined, 0, MAX_AMOUNT_CENTS + 1])('rejects %j', (cents) => {
    expect(isValidAmount(cents)).toBe(false);
  });
});

describe('amountText', () => {
  it('writes cents back the way the form reads them', () => {
    expect(parseAmountCents(amountText(-28640))).toBe(28640);
  });
});
