import { Income, PortfolioLine, Trade } from './investments';
import {
  appliedByMonth,
  distribution,
  filterLines,
  incomeByMonth,
  lineValueCents,
  monthKeys,
} from './investments-analytics';

function line(
  id: string,
  kind: PortfolioLine['investment']['kind'],
  cost: number,
  value?: number,
): PortfolioLine {
  return {
    investment: { id, name: id.toUpperCase(), kind },
    quantityThousandths: 1000,
    costCents: cost,
    valueCents: value,
    incomeCents: 0,
  };
}

describe('investments analytics', () => {
  it('lists the months ending at the current one, across a year change', () => {
    expect(monthKeys('2026-02-10', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });

  it('values a line at cost while it has no price', () => {
    expect(lineValueCents(line('a', 'stock', 500))).toBe(500);
  });

  it('filters lines by kind and by investment', () => {
    const lines = [line('a', 'stock', 1), line('b', 'fund', 1), line('c', 'stock', 1)];

    expect([
      filterLines(lines, {}).length,
      filterLines(lines, { kind: 'stock' }).map((item) => item.investment.id),
      filterLines(lines, { kind: 'stock', investmentId: 'c' }).map((item) => item.investment.id),
    ]).toEqual([3, ['a', 'c'], ['c']]);
  });

  it('adds up proventos of the chosen investments by month', () => {
    const incomes: Income[] = [
      { id: '1', investmentId: 'a', date: '2026-10-28', kind: 'dividend', amountCents: 1500 },
      { id: '2', investmentId: 'a', date: '2026-11-02', kind: 'yield', amountCents: 500 },
      { id: '3', investmentId: 'b', date: '2026-11-03', kind: 'yield', amountCents: 900 },
    ];

    expect(incomeByMonth(incomes, new Set(['a']), ['2026-09', '2026-10', '2026-11'])).toEqual([
      0, 1500, 500,
    ]);
  });

  it('accumulates what was put in, taking sales out', () => {
    const trades: Trade[] = [
      {
        id: '1',
        investmentId: 'a',
        date: '2026-09-05',
        kind: 'buy',
        quantityThousandths: 10000,
        unitPriceCents: 1000,
      },
      {
        id: '2',
        investmentId: 'a',
        date: '2026-10-05',
        kind: 'sell',
        quantityThousandths: 5000,
        unitPriceCents: 1000,
      },
    ];

    expect(appliedByMonth(trades, new Set(['a']), ['2026-08', '2026-09', '2026-10'])).toEqual([
      0, 10000, 5000,
    ]);
  });

  it('splits the value between kinds, biggest first', () => {
    const slices = distribution([
      line('a', 'stock', 100, 300),
      line('b', 'fund', 100),
      line('c', 'stock', 100, 100),
    ]);

    expect(slices).toEqual([
      { kind: 'stock', valueCents: 400, percent: 80 },
      { kind: 'fund', valueCents: 100, percent: 20 },
    ]);
  });

  it('has no slices for a portfolio worth nothing', () => {
    expect(distribution([])).toEqual([]);
  });
});
