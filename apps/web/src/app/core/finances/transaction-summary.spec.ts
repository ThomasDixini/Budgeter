import { SAMPLE_OCTOBER } from './fake-finances-gateways';
import { sum, summarize } from './transaction-summary';

describe('summarize', () => {
  it('adds up income, expenses, net and count', () => {
    expect(summarize(SAMPLE_OCTOBER)).toEqual({
      incomeCents: 950000,
      expenseCents: 34530,
      netCents: 915470,
      count: 3,
    });
  });

  it('is all zeros without transactions', () => {
    expect(summarize([])).toEqual({ incomeCents: 0, expenseCents: 0, netCents: 0, count: 0 });
  });
});

describe('sum', () => {
  it('adds signed amounts', () => {
    expect(sum([100, -40])).toBe(60);
  });
});
