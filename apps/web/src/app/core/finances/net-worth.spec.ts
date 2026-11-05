import { Account } from './finance-references';
import { netWorth, netWorthGrowth, netWorthRows } from './net-worth';

const CHECKING: Account = {
  id: 'checking-account',
  name: 'Checking account',
  kind: 'bankAccount',
  openingBalanceCents: 0,
};
const SAVINGS: Account = { ...CHECKING, id: 'savings', name: 'Savings' };
const CARD: Account = {
  id: 'credit-card',
  name: 'Credit card',
  kind: 'creditCard',
  openingBalanceCents: 0,
  card: { limitCents: 500000, closingDay: 3, dueDay: 10 },
};

describe('netWorth', () => {
  it('adds the bank balances and the investments and takes away what the cards owe', () => {
    const result = netWorth(
      [CHECKING, CARD],
      new Map([
        ['checking-account', 100000],
        ['credit-card', -28640],
      ]),
      [{ id: 'petr4', name: 'PETR4', valueCents: 120000 }],
    );

    expect([
      result.bankCents,
      result.investmentsCents,
      result.cardsOwedCents,
      result.assetsCents,
      result.totalCents,
    ]).toEqual([100000, 120000, 28640, 220000, 191360]);
  });

  it('lists each account, investment and card owed on its own', () => {
    const result = netWorth(
      [CHECKING, SAVINGS, CARD],
      new Map([
        ['checking-account', 1000],
        ['savings', 2000],
        ['credit-card', -500],
      ]),
      [{ id: 'itsa4', name: 'ITSA4', valueCents: 3000 }],
    );

    expect([
      result.bankAccounts.map((item) => [item.name, item.cents]),
      result.investments.map((item) => [item.name, item.cents]),
      result.cards.map((item) => [item.name, item.cents]),
    ]).toEqual([
      [
        ['Checking account', 1000],
        ['Savings', 2000],
      ],
      [['ITSA4', 3000]],
      [['Credit card', 500]],
    ]);
  });

  it('splits the assets between bank accounts and investments, adding up to 100', () => {
    const result = netWorth([CHECKING], new Map([['checking-account', 1000]]), [
      { id: 'a', name: 'A', valueCents: 2000 },
    ]);

    expect([result.bankPercent, result.investmentsPercent]).toEqual([33, 67]);
  });

  it('leaves out a closed position and shows no shares without assets', () => {
    const result = netWorth([CHECKING], new Map(), [{ id: 'a', name: 'A', valueCents: 0 }]);

    expect([result.investments, result.bankPercent, result.investmentsPercent]).toEqual([[], 0, 0]);
  });

  it('is negative when more is owed than owned, and a card paid ahead owes nothing', () => {
    const result = netWorth(
      [CHECKING, CARD],
      new Map([
        ['checking-account', 1000],
        ['credit-card', -5000],
      ]),
      [],
    );
    const paidAhead = netWorth([CARD], new Map([['credit-card', 700]]), []);

    expect([result.totalCents, paidAhead.cardsOwedCents]).toEqual([-4000, 0]);
  });

  it('keeps an overdrawn account from pushing the shares out of range', () => {
    const result = netWorth([CHECKING], new Map([['checking-account', -500]]), [
      { id: 'a', name: 'A', valueCents: 2000 },
    ]);

    expect([result.bankPercent, result.investmentsPercent]).toEqual([0, 100]);
  });
});

describe('net worth history', () => {
  const points = [
    { month: '2026-08', cents: 100_000 },
    { month: '2026-09', cents: 110_000 },
    { month: '2026-10', cents: 105_000 },
    { month: '2026-11', cents: 125_000 },
  ];

  it('compares each month with the one before', () => {
    expect(
      netWorthRows(points).map((row) => [row.month, row.changeCents, row.changePercent]),
    ).toEqual([
      ['2026-09', 10_000, 10],
      ['2026-10', -5_000, (-5_000 / 110_000) * 100],
      ['2026-11', 20_000, (20_000 / 105_000) * 100],
    ]);
  });

  it('works out growth, monthly average and best month', () => {
    expect(netWorthGrowth(points)).toMatchObject({
      growthCents: 25_000,
      growthPercent: 25,
      averageCents: 8_333,
      best: { month: '2026-11', changeCents: 20_000 },
    });
  });

  it('has no growth to tell with fewer than two months', () => {
    expect([netWorthGrowth([]), netWorthGrowth(points.slice(0, 1))]).toEqual([
      undefined,
      undefined,
    ]);
  });
});
