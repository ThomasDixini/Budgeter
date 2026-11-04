import {
  Income,
  Investment,
  MonthlyPoint,
  Portfolio,
  PortfolioLine,
  Trade,
  tradeTotalCents,
} from '../investments';
import { monthKeys } from '../period';
import { daysBetweenDays, monthEnd } from './demo-dates';

/** The price of one unit of an investment on a day, in cents; undefined before it was bought or priced. */
export type PriceOn = (investmentId: string, day: string) => number | undefined;

/** The CDI the made-up portfolio is compared with, a year's worth. */
const CDI_PER_YEAR = 0.1065;
const DAYS_PER_YEAR = 365;
const MONTHS_PER_YEAR = 12;
const HISTORY_MONTHS = 24;
const PERCENT = 100;
const THOUSANDTHS = 1000;

interface Holding {
  quantityThousandths: number;
  costCents: number;
}

/**
 * Works the portfolio out of the investments, trades and proventos as the API would: units and cost by the
 * average price, value at the price of the day, the gain with proventos against the CDI on the same money,
 * and a month-end history for the charts.
 * @example portfolioAt({ investments, trades, incomes, priceOn, asOf: '2026-11-04' }).totals.valueCents
 */
export function portfolioAt(input: {
  investments: readonly Investment[];
  trades: readonly Trade[];
  incomes: readonly Income[];
  priceOn: PriceOn;
  asOf: string;
}): Portfolio {
  const { investments, priceOn, asOf } = input;
  const trades = input.trades.filter((trade) => trade.date <= asOf);
  const incomes = input.incomes.filter((income) => income.date <= asOf);
  const lines = investments.map((investment) => lineOf(investment, trades, incomes, priceOn, asOf));
  const costCents = sum(lines.map((line) => line.costCents));
  const valueCents = sum(lines.map((line) => line.valueCents ?? line.costCents));
  const incomeCents = sum(incomes.map((income) => income.amountCents));
  const cdiGainCents = cdiGainOf(trades, asOf);
  const gainCents = valueCents - costCents + incomeCents;
  return {
    lines,
    totals: {
      costCents,
      valueCents,
      unpricedCount: lines.filter(
        (line) => line.quantityThousandths > 0 && line.valueCents === undefined,
      ).length,
      incomeCents,
      incomeLast12MonthsCents: sum(
        incomes
          .filter((income) => daysBetweenDays(income.date, asOf) <= DAYS_PER_YEAR)
          .map((income) => income.amountCents),
      ),
    },
    performance: {
      investedCents: costCents,
      gainCents,
      gainPercent: percentOf(gainCents, costCents),
      cdiGainCents,
      cdiPercent: percentOf(cdiGainCents, costCents),
      cdiThrough: asOf,
    },
    history: historyOf({ ...input, trades, incomes }),
    trades,
    incomes,
  };
}

function lineOf(
  investment: Investment,
  trades: readonly Trade[],
  incomes: readonly Income[],
  priceOn: PriceOn,
  asOf: string,
): PortfolioLine {
  const holding = holdingOf(trades.filter((trade) => trade.investmentId === investment.id));
  const price = priceOn(investment.id, asOf);
  const valueCents =
    price === undefined ? undefined : tradeTotalCents(holding.quantityThousandths, price);
  return {
    investment: {
      ...investment,
      price: price === undefined ? undefined : { cents: price, on: asOf },
    },
    quantityThousandths: holding.quantityThousandths,
    costCents: holding.costCents,
    valueCents,
    gainCents: valueCents === undefined ? undefined : valueCents - holding.costCents,
    incomeCents: sum(
      incomes
        .filter((income) => income.investmentId === investment.id)
        .map((income) => income.amountCents),
    ),
  };
}

/** Units and cost by the average price: a sale takes out the units at what they cost on average. */
function holdingOf(trades: readonly Trade[]): Holding {
  const holding: Holding = { quantityThousandths: 0, costCents: 0 };
  for (const trade of [...trades].sort((first, second) => first.date.localeCompare(second.date))) {
    if (trade.kind === 'buy') {
      holding.quantityThousandths += trade.quantityThousandths;
      holding.costCents += tradeTotalCents(trade.quantityThousandths, trade.unitPriceCents);
    } else {
      const average =
        holding.quantityThousandths === 0 ? 0 : holding.costCents / holding.quantityThousandths;
      holding.costCents -= Math.round(average * trade.quantityThousandths);
      holding.quantityThousandths -= trade.quantityThousandths;
    }
  }
  return holding;
}

/** What the money put in (and taken out) would have earned in the CDI by `asOf`. */
function cdiGainOf(trades: readonly Trade[], asOf: string): number {
  return Math.round(
    sum(
      trades.map((trade) => {
        const money = tradeTotalCents(trade.quantityThousandths, trade.unitPriceCents);
        const growth =
          (1 + CDI_PER_YEAR) ** (daysBetweenDays(trade.date, asOf) / DAYS_PER_YEAR) - 1;
        return (trade.kind === 'buy' ? money : -money) * growth;
      }),
    ),
  );
}

function historyOf(input: {
  investments: readonly Investment[];
  trades: readonly Trade[];
  incomes: readonly Income[];
  priceOn: PriceOn;
  asOf: string;
}): MonthlyPoint[] {
  const { investments, trades, incomes, priceOn, asOf } = input;
  const months = monthKeys(asOf, HISTORY_MONTHS);
  const first = months.findIndex((month) =>
    trades.some((trade) => trade.date.slice(0, 7) <= month),
  );
  if (first < 0) return [];
  const monthlyCdi = (1 + CDI_PER_YEAR) ** (1 / MONTHS_PER_YEAR) - 1;
  return months.slice(first).map((month, step) => {
    const end = month === asOf.slice(0, 7) ? asOf : monthEnd(month);
    const upTo = trades.filter((trade) => trade.date <= end);
    const valueCents = sum(
      investments.map((investment) => {
        const holding = holdingOf(upTo.filter((trade) => trade.investmentId === investment.id));
        const price = priceOn(investment.id, end);
        return price === undefined
          ? holding.costCents
          : tradeTotalCents(holding.quantityThousandths, price);
      }),
    );
    const appliedCents = sum(
      upTo.map((trade) => {
        const money = tradeTotalCents(trade.quantityThousandths, trade.unitPriceCents);
        return trade.kind === 'buy' ? money : -money;
      }),
    );
    const received = sum(
      incomes.filter((income) => income.date <= end).map((income) => income.amountCents),
    );
    return {
      month,
      valueCents,
      appliedCents,
      returnPercent: percentOf(valueCents + received - appliedCents, appliedCents),
      cdiPercent: ((1 + monthlyCdi) ** (step + 1) - 1) * PERCENT,
    };
  });
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function percentOf(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * PERCENT * 100) / 100;
}

/** Units as a plain count, for the demo data that is written with whole numbers of units. */
export function units(count: number): number {
  return count * THOUSANDTHS;
}
