import { Income, Investment, Trade } from '../investments';
import { portfolioAt, units } from './demo-portfolio';

const INVESTMENTS: Investment[] = [
  { id: 'a', name: 'AAAA3', kind: 'stock' },
  { id: 'b', name: 'BBBB11', kind: 'realEstateFund' },
];

function trade(
  id: string,
  investmentId: string,
  date: string,
  kind: 'buy' | 'sell',
  quantity: number,
  priceCents: number,
): Trade {
  return {
    id,
    investmentId,
    date,
    kind,
    quantityThousandths: units(quantity),
    unitPriceCents: priceCents,
  };
}

const TRADES: Trade[] = [
  trade('t1', 'a', '2026-08-10', 'buy', 10, 1000),
  trade('t2', 'a', '2026-09-10', 'buy', 10, 1400),
  trade('t3', 'a', '2026-10-10', 'sell', 5, 1500),
  trade('t4', 'b', '2026-10-15', 'buy', 4, 10_000),
];
const INCOMES: Income[] = [
  { id: 'i1', investmentId: 'a', date: '2026-10-20', kind: 'dividend', amountCents: 500 },
];
const PRICES: Record<string, number> = { a: 1600, b: 9000 };
const priceOn = (id: string): number | undefined => PRICES[id];

function build(asOf = '2026-11-04') {
  return portfolioAt({ investments: INVESTMENTS, trades: TRADES, incomes: INCOMES, priceOn, asOf });
}

describe('portfolioAt', () => {
  it('keeps units and cost by the average price, taking a sale out at what the units cost on average', () => {
    const [a, b] = build().lines;

    expect([a.quantityThousandths, a.costCents, b.quantityThousandths, b.costCents]).toEqual([
      units(15),
      18_000,
      units(4),
      40_000,
    ]);
  });

  it('values the units at the price of the day and works out the gain per line', () => {
    const [a, b] = build().lines;

    expect([a.valueCents, a.gainCents, b.valueCents, b.gainCents, a.investment.price]).toEqual([
      24_000,
      6000,
      36_000,
      -4000,
      { cents: 1600, on: '2026-11-04' },
    ]);
  });

  it('adds up the totals and counts the gain with the proventos', () => {
    const { totals, performance } = build();

    expect([
      totals.costCents,
      totals.valueCents,
      totals.incomeCents,
      performance?.gainCents,
    ]).toEqual([58_000, 60_000, 500, 2500]);
  });

  it('values at cost and counts as unpriced what has no price', () => {
    const portfolio = portfolioAt({
      investments: INVESTMENTS,
      trades: TRADES,
      incomes: [],
      priceOn: (id) => (id === 'a' ? 1600 : undefined),
      asOf: '2026-11-04',
    });

    expect([
      portfolio.totals.unpricedCount,
      portfolio.totals.valueCents,
      portfolio.lines[1].valueCents,
    ]).toEqual([1, 64_000, undefined]);
  });

  it('only counts what had happened by the day asked', () => {
    const portfolio = build('2026-09-30');

    expect([
      portfolio.trades.length,
      portfolio.incomes.length,
      portfolio.lines[1].quantityThousandths,
    ]).toEqual([2, 0, 0]);
  });

  it('draws a month-end history from the first purchase, with the money applied and the CDI growing', () => {
    const history = build().history ?? [];

    expect([
      history.map((point) => point.month),
      history.map((point) => point.appliedCents),
    ]).toEqual([
      ['2026-08', '2026-09', '2026-10', '2026-11'],
      [10_000, 24_000, 56_500, 56_500],
    ]);
    expect(
      history.every(
        (point, index) => index === 0 || point.cdiPercent > history[index - 1].cdiPercent,
      ),
    ).toBe(true);
  });

  it('has an empty history before any purchase', () => {
    const portfolio = portfolioAt({
      investments: INVESTMENTS,
      trades: [],
      incomes: [],
      priceOn,
      asOf: '2026-11-04',
    });

    expect(portfolio.history).toEqual([]);
  });
});
