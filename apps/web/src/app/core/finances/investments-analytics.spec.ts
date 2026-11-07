import { Income, MonthlyPoint, PortfolioLine, Trade } from './investments';
import {
  appliedByMonth,
  distribution,
  filterLines,
  incomeByMonth,
  lineValueCents,
  periodPerformance,
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

describe('income in a range', () => {
  it('counts only the proventos received on the days of a range', () => {
    const incomes: Income[] = [
      { id: '1', investmentId: 'a', date: '2026-10-05', kind: 'yield', amountCents: 100 },
      { id: '2', investmentId: 'a', date: '2026-10-20', kind: 'yield', amountCents: 200 },
    ];

    expect(
      incomeByMonth(incomes, new Set(['a']), ['2026-10'], { from: '2026-10-10', to: '2026-10-31' }),
    ).toEqual([200]);
  });
});

function point(month: string, returnPercent: number, cdiPercent: number): MonthlyPoint {
  return { month, valueCents: 0, appliedCents: 0, returnPercent, cdiPercent };
}

describe('period performance', () => {
  it('takes the change between the first and the last month, not the total since purchase', () => {
    const result = periodPerformance([
      point('2026-08', 10, 2),
      point('2026-09', 12, 3),
      point('2026-10', 21, 4.04),
    ]);

    expect(result?.returnPercent).toBeCloseTo(10, 5);
    expect(result?.cdiPercent).toBeCloseTo(2, 5);
  });

  it('skips the months with no figures', () => {
    const result = periodPerformance([undefined, point('2026-09', 0, 0), point('2026-10', 5, 1)]);

    expect(result?.returnPercent).toBeCloseTo(5, 5);
  });

  it('is unknown with fewer than two months', () => {
    expect([periodPerformance([]), periodPerformance([point('2026-10', 5, 1)])]).toEqual([
      undefined,
      undefined,
    ]);
  });
});
