/** What sort of asset an investment is; only used to label it. */
export type InvestmentKind = 'stock' | 'realEstateFund' | 'fixedIncome' | 'fund' | 'other';
export type TradeKind = 'buy' | 'sell';
/** What sort of provento was received. */
export type IncomeKind = 'dividend' | 'interestOnEquity' | 'yield';

/** The latest price typed for one unit of an investment, and the day it is from. */
export interface PricePoint {
  readonly cents: number;
  /** Local calendar day, `YYYY-MM-DD`. */
  readonly on: string;
}

export interface Investment {
  readonly id: string;
  readonly name: string;
  readonly kind: InvestmentKind;
  /** Absent until a price is typed; the investment is then valued at what it cost. */
  readonly price?: PricePoint;
}

/** What the investment form fills in; the id is given by the store. */
export type InvestmentDraft = Omit<Investment, 'id'>;

/** One investment as held today. */
export interface PortfolioLine {
  readonly investment: Investment;
  /** Units held, in thousandths of a unit. */
  readonly quantityThousandths: number;
  readonly costCents: number;
  /** Absent when units are held but no price is known. */
  readonly valueCents?: number;
  readonly gainCents?: number;
  /** Everything the investment paid out so far. */
  readonly incomeCents: number;
}

export interface PortfolioTotals {
  readonly costCents: number;
  readonly valueCents: number;
  /** How many held investments are valued at cost for lack of a price. */
  readonly unpricedCount: number;
  readonly incomeCents: number;
  readonly incomeLast12MonthsCents: number;
}

/** How the portfolio did against leaving the same money in the CDI. */
export interface Performance {
  readonly investedCents: number;
  readonly gainCents: number;
  readonly gainPercent: number;
  readonly cdiGainCents: number;
  readonly cdiPercent: number;
  /** The last day a CDI rate is known for; absent when none could be fetched. */
  readonly cdiThrough?: string;
}

export interface Trade {
  readonly id: string;
  readonly investmentId: string;
  readonly date: string;
  readonly kind: TradeKind;
  readonly quantityThousandths: number;
  readonly unitPriceCents: number;
}

export type TradeDraft = Omit<Trade, 'id'>;

export interface Income {
  readonly id: string;
  readonly investmentId: string;
  readonly date: string;
  readonly kind: IncomeKind;
  readonly amountCents: number;
}

export type IncomeDraft = Omit<Income, 'id'>;

/** The whole portfolio at the end of one month; what the evolution and return charts plot. */
export interface MonthlyPoint {
  /** `YYYY-MM`. */
  readonly month: string;
  readonly valueCents: number;
  readonly appliedCents: number;
  /** Accumulated return of the portfolio up to the month, in percent. */
  readonly returnPercent: number;
  /** Accumulated CDI on the same money up to the month, in percent. */
  readonly cdiPercent: number;
}

/** What the page reads. */
export interface Portfolio {
  readonly lines: readonly PortfolioLine[];
  readonly totals: PortfolioTotals;
  readonly performance?: Performance;
  /** Month-end history sent by the API, valued at the real closing prices; empty before the first trade. */
  readonly history?: readonly MonthlyPoint[];
  readonly trades: readonly Trade[];
  readonly incomes: readonly Income[];
}

/** One line of the movements list: a purchase, a sale or a provento. */
export interface Movement {
  readonly key: string;
  readonly id: string;
  readonly type: 'trade' | 'income';
  readonly date: string;
  readonly investmentName: string;
  readonly label: string;
  /** Signed from the portfolio's side: purchases negative, sales and proventos positive. */
  readonly cents: number;
}

const THOUSANDTHS = 1000;
/** Typed quantities: whole units with up to 3 decimals after a comma or a dot. */
const QUANTITY_PATTERN = /^(\d{1,9})(?:[.,](\d{1,3}))?$/;
const MAX_QUANTITY_THOUSANDTHS = 1_000_000_000_000;

export const INVESTMENT_KIND_OPTIONS: readonly { value: InvestmentKind; label: string }[] = [
  { value: 'stock', label: 'Stock' },
  { value: 'realEstateFund', label: 'Real estate fund' },
  { value: 'fixedIncome', label: 'Fixed income' },
  { value: 'fund', label: 'Fund' },
  { value: 'other', label: 'Other' },
];

export const INCOME_KIND_OPTIONS: readonly { value: IncomeKind; label: string }[] = [
  { value: 'dividend', label: 'Dividend' },
  { value: 'interestOnEquity', label: 'Interest on equity' },
  { value: 'yield', label: 'Fund yield' },
];

/**
 * The label of an investment kind.
 * @example investmentKindLabel('realEstateFund') // 'Real estate fund'
 */
export function investmentKindLabel(kind: InvestmentKind): string {
  return INVESTMENT_KIND_OPTIONS.find((option) => option.value === kind)?.label ?? kind;
}

/**
 * The label of a provento kind.
 * @example incomeKindLabel('interestOnEquity') // 'Interest on equity'
 */
export function incomeKindLabel(kind: IncomeKind): string {
  return INCOME_KIND_OPTIONS.find((option) => option.value === kind)?.label ?? kind;
}

/**
 * Reads a quantity typed by the user as thousandths of a unit; undefined when it is not shaped like
 * `100` or `2,5`.
 * @example parseQuantityThousandths('2,5') // 2500
 */
export function parseQuantityThousandths(text: string): number | undefined {
  const match = QUANTITY_PATTERN.exec(text.trim());
  if (match === null) return undefined;
  const fraction = (match[2] ?? '').padEnd(3, '0');
  return Number(match[1]) * THOUSANDTHS + Number(fraction);
}

/**
 * Whether a typed quantity can be saved: read, above zero and within the API's limit.
 * @example isValidQuantity(parseQuantityThousandths('0')) // false
 */
export function isValidQuantity(thousandths: number | undefined): thousandths is number {
  return thousandths !== undefined && thousandths > 0 && thousandths <= MAX_QUANTITY_THOUSANDTHS;
}

/**
 * A quantity written the way it is read back: no trailing zeros.
 * @example quantityText(2500) // '2.5'
 */
export function quantityText(thousandths: number): string {
  const whole = Math.floor(thousandths / THOUSANDTHS);
  const fraction = String(thousandths % THOUSANDTHS)
    .padStart(3, '0')
    .replace(/0+$/, '');
  return fraction === '' ? String(whole) : `${whole}.${fraction}`;
}

/**
 * What a quantity at a unit price comes to, in cents.
 * @example tradeTotalCents(2500, 1001) // 2503
 */
export function tradeTotalCents(quantityThousandths: number, unitPriceCents: number): number {
  return Math.round((quantityThousandths * unitPriceCents) / THOUSANDTHS);
}

/**
 * The average price of the units held, in cents; 0 when nothing is held.
 * @example averagePriceCents({ ...line, quantityThousandths: 100000, costCents: 100000 }) // 1000
 */
export function averagePriceCents(
  line: Pick<PortfolioLine, 'quantityThousandths' | 'costCents'>,
): number {
  if (line.quantityThousandths === 0) return 0;
  return Math.round((line.costCents * THOUSANDTHS) / line.quantityThousandths);
}

/**
 * A percentage with its sign.
 * @example formatPercent(20, 'en-US') // '+20.00%'
 */
export function formatPercent(percent: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'exceptZero',
  }).format(percent / 100);
}

/**
 * Purchases, sales and proventos in one list, newest day first; within a day the order given is kept
 * (trades, then proventos).
 * @example movements(portfolio, new Map([['petr4', 'PETR4']]))[0].label // 'Buy 100'
 */
export function movements(
  portfolio: Pick<Portfolio, 'trades' | 'incomes'>,
  investmentNames: ReadonlyMap<string, string>,
): Movement[] {
  const name = (investmentId: string): string =>
    investmentNames.get(investmentId) ?? 'Unknown investment';
  const trades = portfolio.trades.map((trade): Movement => ({
    key: `trade:${trade.id}`,
    id: trade.id,
    type: 'trade',
    date: trade.date,
    investmentName: name(trade.investmentId),
    label: `${trade.kind === 'buy' ? 'Buy' : 'Sell'} ${quantityText(trade.quantityThousandths)}`,
    cents: signedTradeCents(trade),
  }));
  const incomes = portfolio.incomes.map((income): Movement => ({
    key: `income:${income.id}`,
    id: income.id,
    type: 'income',
    date: income.date,
    investmentName: name(income.investmentId),
    label: incomeKindLabel(income.kind),
    cents: income.amountCents,
  }));
  return [...trades, ...incomes].sort((first, second) => second.date.localeCompare(first.date));
}

function signedTradeCents(trade: Trade): number {
  const total = tradeTotalCents(trade.quantityThousandths, trade.unitPriceCents);
  return trade.kind === 'buy' ? -total : total;
}
