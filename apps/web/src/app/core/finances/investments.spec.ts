import {
  averagePriceCents,
  formatPercent,
  incomeKindLabel,
  investmentKindLabel,
  isValidQuantity,
  movements,
  parseQuantityThousandths,
  quantityText,
  tradeTotalCents,
} from './investments';
import { SAMPLE_PORTFOLIO } from './fake-investments-gateway';

describe('parseQuantityThousandths', () => {
  it.each([
    ['100', 100000],
    ['2,5', 2500],
    ['0.001', 1],
    [' 12.34 ', 12340],
  ])('reads "%s" as %s thousandths', (text, expected) => {
    expect(parseQuantityThousandths(text)).toBe(expected);
  });

  it.each(['', 'abc', '1.2345', '-1', '1,2,3'])('does not read "%s"', (text) => {
    expect(parseQuantityThousandths(text)).toBeUndefined();
  });
});

describe('isValidQuantity', () => {
  it('needs a quantity above zero within the API limit', () => {
    expect([
      isValidQuantity(undefined),
      isValidQuantity(0),
      isValidQuantity(1),
      isValidQuantity(1_000_000_000_001),
    ]).toEqual([false, false, true, false]);
  });
});

describe('quantityText', () => {
  it('drops trailing zeros and keeps what is needed', () => {
    expect([
      quantityText(100000),
      quantityText(2500),
      quantityText(1),
      quantityText(12340),
    ]).toEqual(['100', '2.5', '0.001', '12.34']);
  });
});

describe('tradeTotalCents', () => {
  it('multiplies units by price and rounds to the cent', () => {
    expect([tradeTotalCents(2500, 1001), tradeTotalCents(100000, 1000)]).toEqual([2503, 100000]);
  });
});

describe('averagePriceCents', () => {
  it('is the cost per unit held, and zero when nothing is held', () => {
    expect([
      averagePriceCents({ quantityThousandths: 100000, costCents: 110000 }),
      averagePriceCents({ quantityThousandths: 0, costCents: 0 }),
    ]).toEqual([1100, 0]);
  });
});

describe('formatPercent', () => {
  it('writes the sign and two decimals, and nothing for zero', () => {
    expect([
      formatPercent(20, 'en-US'),
      formatPercent(-1.5, 'en-US'),
      formatPercent(0, 'en-US'),
    ]).toEqual(['+20.00%', '-1.50%', '0.00%']);
  });
});

describe('kind labels', () => {
  it('spell the kinds out', () => {
    expect([investmentKindLabel('realEstateFund'), incomeKindLabel('interestOnEquity')]).toEqual([
      'Real estate fund',
      'Interest on equity',
    ]);
  });
});

describe('movements', () => {
  const names = new Map([
    ['petr4', 'PETR4'],
    ['xpml11', 'XPML11'],
  ]);

  it('lists purchases, sales and proventos newest first, signed from the portfolio side', () => {
    const list = movements(SAMPLE_PORTFOLIO, names);

    expect(list.map((item) => [item.date, item.investmentName, item.label, item.cents])).toEqual([
      ['2026-10-28', 'PETR4', 'Dividend', 1500],
      ['2026-10-20', 'XPML11', 'Buy 10', -11000],
      ['2026-10-05', 'PETR4', 'Buy 100', -100000],
    ]);
  });

  it('counts a sale as money back', () => {
    const [sale] = movements(
      {
        trades: [
          {
            id: 's',
            investmentId: 'petr4',
            date: '2026-11-01',
            kind: 'sell',
            quantityThousandths: 40000,
            unitPriceCents: 1500,
          },
        ],
        incomes: [],
      },
      names,
    );

    expect([sale.label, sale.cents]).toEqual(['Sell 40', 60000]);
  });
});
