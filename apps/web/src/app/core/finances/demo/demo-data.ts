import { CardPayment } from '../account-statement';
import { Bill } from '../bills';
import { Account, FinanceCategory } from '../finance-references';
import { IncomeSplit } from '../income-split';
import { Income, Investment, Trade } from '../investments';
import { Transaction } from '../transaction';
import { addDays, addMonths, dayOfMonth } from './demo-dates';
import { units } from './demo-portfolio';
import { invoiceCycleOf } from './demo-statements';

/** Everything the demo starts with: made up, but consistent with itself. */
export interface DemoData {
  readonly categories: FinanceCategory[];
  readonly accounts: Account[];
  readonly transactions: Transaction[];
  readonly payments: CardPayment[];
  readonly bills: Bill[];
  readonly split: IncomeSplit;
  readonly investments: Investment[];
  readonly trades: Trade[];
  readonly incomes: Income[];
  /** The price of one unit of an investment at the start of each month, in cents, oldest month first. */
  readonly prices: Record<string, number[]>;
  /** The `YYYY-MM` month the first price belongs to. */
  readonly firstPriceMonth: string;
}

/** What the demo calls its accounts, which the rest of the app finds by id. */
export const DEMO_CHECKING = 'checking-account';
export const DEMO_SAVINGS = 'savings-account';
export const DEMO_CARD = 'credit-card';

const MONTHS_BACK = 13;
const PRICE_MONTHS = 26;
const SALARY_CENTS = 850_000;

type Language = 'en-US' | 'pt-BR';

const WORDS: Record<string, readonly [english: string, portuguese: string]> = {
  salary: ['Salary', 'Salário'],
  rent: ['Rent', 'Aluguel'],
  condo: ['Condo fee', 'Condomínio'],
  internet: ['Internet', 'Internet'],
  streaming: ['Streaming', 'Streaming'],
  phone: ['Phone plan', 'Plano de celular'],
  energy: ['Electricity', 'Energia elétrica'],
  water: ['Water', 'Água'],
  course: ['Course', 'Curso'],
  invest: ['Investments transfer', 'Aporte em investimentos'],
  gym: ['Gym', 'Academia'],
  fuel: ['Fuel', 'Combustível'],
  ride: ['Ride app', 'App de transporte'],
  pharmacy: ['Pharmacy', 'Farmácia'],
  freelance: ['Freelance job', 'Trabalho freelancer'],
  yield: ['Savings yield', 'Rendimento da poupança'],
  checking: ['Checking account', 'Conta corrente'],
  savings: ['Savings', 'Poupança'],
  card: ['Credit card', 'Cartão de crédito'],
  needs: ['Needs', 'Necessidades'],
  wants: ['Wants', 'Desejos'],
  goals: ['Investments', 'Investimentos'],
  market: ['Supermarket', 'Supermercado'],
  greens: ['Greengrocer', 'Hortifruti'],
  bakery: ['Bakery', 'Padaria'],
  restaurant: ['Restaurant', 'Restaurante'],
  pizza: ['Pizzeria', 'Pizzaria'],
  lunch: ['Lunch', 'Almoço'],
  cinema: ['Cinema', 'Cinema'],
  concert: ['Concert', 'Show'],
  books: ['Bookstore', 'Livraria'],
  trip: ['Weekend trip', 'Viagem de fim de semana'],
};

const INVESTMENTS: readonly {
  id: string;
  name: string;
  kind: Investment['kind'];
  price: number;
  drift: number;
}[] = [
  { id: 'demo-petr4', name: 'PETR4', kind: 'stock', price: 3850, drift: 0.012 },
  { id: 'demo-itub4', name: 'ITUB4', kind: 'stock', price: 3120, drift: 0.01 },
  { id: 'demo-wege3', name: 'WEGE3', kind: 'stock', price: 4260, drift: 0.014 },
  { id: 'demo-hglg11', name: 'HGLG11', kind: 'realEstateFund', price: 16_200, drift: 0.004 },
  { id: 'demo-xplg11', name: 'XPLG11', kind: 'realEstateFund', price: 10_400, drift: 0.003 },
  { id: 'demo-ivvb11', name: 'IVVB11', kind: 'fund', price: 31_500, drift: 0.011 },
  {
    id: 'demo-selic',
    name: 'Tesouro Selic 2031',
    kind: 'fixedIncome',
    price: 1_750_000,
    drift: 0.0085,
  },
  {
    id: 'demo-cdb',
    name: 'CDB Banco Demo 110% CDI',
    kind: 'fixedIncome',
    price: 100_000,
    drift: 0.0092,
  },
];

/**
 * Builds the made-up Finances data: a year of salary, bills, spending on the account and the card, the
 * card invoices paid, bills to pay and receive, an income split, and a portfolio bought a little each month
 * with its yields. The same day (and language of the descriptions) always gives the same data.
 * @example buildDemoData('2026-11-04', 'pt-BR').accounts.length // 3
 */
export function buildDemoData(today: string, language: Language): DemoData {
  const word = (key: string): string => WORDS[key][language === 'pt-BR' ? 1 : 0];
  const months = Array.from({ length: MONTHS_BACK }, (_, index) =>
    addMonths(today, index - MONTHS_BACK + 1),
  );
  const accounts = buildAccounts(word);
  const firstPriceMonth = addMonths(today, 1 - PRICE_MONTHS);
  const prices = buildPrices(firstPriceMonth);
  const activityMonths = Array.from({ length: PRICE_MONTHS - 1 }, (_, index) =>
    addMonths(today, index - PRICE_MONTHS + 2),
  );
  const { trades, incomes } = buildInvestmentActivity(
    activityMonths,
    today,
    prices,
    firstPriceMonth,
  );
  const transactions = months.flatMap((month) =>
    monthOfTransactions(month, today, word, investedIn(trades, month)),
  );
  const payments = buildPayments(accounts[2], transactions, months, today);
  return {
    categories: buildCategories(),
    accounts,
    transactions: transactions.sort((first, second) => second.date.localeCompare(first.date)),
    payments,
    bills: buildBills(today, word),
    split: buildSplit(word),
    investments: INVESTMENTS.map(({ id, name, kind }) => ({ id, name, kind })),
    trades,
    incomes,
    prices,
    firstPriceMonth,
  };
}

function buildCategories(): FinanceCategory[] {
  return [
    ['housing', 'Housing'],
    ['food', 'Food'],
    ['transport', 'Transport'],
    ['health', 'Health'],
    ['leisure', 'Leisure'],
    ['subscriptions', 'Subscriptions'],
    ['education', 'Education'],
    ['salary', 'Salary'],
    ['extra-income', 'Extra income'],
    ['investments', 'Investments'],
    ['other', 'Other'],
  ].map(([id, name]) => ({ id, name }));
}

function buildAccounts(word: (key: string) => string): Account[] {
  return [
    {
      id: DEMO_CHECKING,
      name: word('checking'),
      kind: 'bankAccount',
      openingBalanceCents: 3_200_000,
    },
    {
      id: DEMO_SAVINGS,
      name: word('savings'),
      kind: 'bankAccount',
      openingBalanceCents: 1_500_000,
    },
    {
      id: DEMO_CARD,
      name: word('card'),
      kind: 'creditCard',
      openingBalanceCents: 0,
      card: { limitCents: 800_000, closingDay: 3, dueDay: 10 },
    },
  ];
}

function buildSplit(word: (key: string) => string): IncomeSplit {
  return {
    baseIncomeCents: SALARY_CENTS,
    parts: [
      {
        id: 'demo-needs',
        name: word('needs'),
        percent: 50,
        color: 0,
        categoryIds: ['housing', 'food', 'transport', 'health'],
      },
      {
        id: 'demo-wants',
        name: word('wants'),
        percent: 30,
        color: 4,
        categoryIds: ['leisure', 'subscriptions', 'other'],
      },
      {
        id: 'demo-goals',
        name: word('goals'),
        percent: 20,
        color: 3,
        categoryIds: ['investments', 'education'],
      },
    ],
  };
}

/** A small, repeatable source of numbers: the same seed always gives the same sequence. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function monthSeed(month: string): number {
  return Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7));
}

function monthOfTransactions(
  month: string,
  today: string,
  word: (key: string) => string,
  investedCents: number,
): Transaction[] {
  const next = random(monthSeed(month));
  const between = (low: number, high: number): number =>
    Math.round((low + next() * (high - low)) / 10) * 10;
  const pick = (keys: readonly string[]): string => word(keys[Math.floor(next() * keys.length)]);
  const entries: Omit<Transaction, 'id'>[] = [];
  const add = (
    day: number,
    key: string,
    categoryId: string,
    accountId: string,
    cents: number,
  ): void =>
    void entries.push({
      date: dayOfMonth(month, day),
      description: key.startsWith('~') ? key.slice(1) : word(key),
      categoryId,
      accountId,
      amountCents: cents,
    });
  add(5, 'salary', 'salary', DEMO_CHECKING, SALARY_CENTS);
  add(8, 'rent', 'housing', DEMO_CHECKING, -210_000);
  add(10, 'condo', 'housing', DEMO_CHECKING, -42_000);
  if (investedCents > 0) add(6, 'invest', 'investments', DEMO_CHECKING, -investedCents);
  add(20, 'energy', 'housing', DEMO_CHECKING, -between(15_000, 26_000));
  add(22, 'water', 'housing', DEMO_CHECKING, -between(6000, 9500));
  add(15, 'internet', 'subscriptions', DEMO_CARD, -11_990);
  add(12, 'streaming', 'subscriptions', DEMO_CARD, -5590);
  add(18, 'phone', 'subscriptions', DEMO_CARD, -8990);
  add(25, 'course', 'education', DEMO_CARD, -35_000);
  add(2, 'gym', 'health', DEMO_CARD, -12_990);
  add(14, 'yield', 'extra-income', DEMO_SAVINGS, between(7000, 9500));
  if (monthSeed(month) % 3 === 0)
    add(20, 'freelance', 'extra-income', DEMO_CHECKING, between(90_000, 180_000));
  for (let index = 0; index < 6; index++) {
    add(
      1 + Math.floor(next() * 28),
      `~${pick(['market', 'greens', 'bakery'])}`,
      'food',
      next() < 0.7 ? DEMO_CARD : DEMO_CHECKING,
      -between(6000, 32_000),
    );
  }
  for (let index = 0; index < 4; index++) {
    add(
      1 + Math.floor(next() * 28),
      `~${pick(['restaurant', 'pizza', 'lunch'])}`,
      'food',
      DEMO_CARD,
      -between(3500, 14_000),
    );
  }
  for (let index = 0; index < 2; index++)
    add(1 + Math.floor(next() * 28), 'fuel', 'transport', DEMO_CARD, -between(15_000, 22_000));
  for (let index = 0; index < 3; index++)
    add(1 + Math.floor(next() * 28), 'ride', 'transport', DEMO_CHECKING, -between(1800, 4500));
  add(1 + Math.floor(next() * 28), 'pharmacy', 'health', DEMO_CHECKING, -between(4000, 16_000));
  for (let index = 0; index < 2 + Math.floor(next() * 2); index++) {
    add(
      1 + Math.floor(next() * 28),
      `~${pick(['cinema', 'concert', 'books', 'trip'])}`,
      'leisure',
      DEMO_CARD,
      -between(4000, 26_000),
    );
  }
  return entries
    .filter((entry) => entry.date <= today)
    .map((entry, index) => ({ ...entry, id: `demo-tx-${month}-${index}` }));
}

/** Each month the invoice that closed is paid from the checking account on its due day. */
function buildPayments(
  card: Account,
  transactions: readonly Transaction[],
  months: readonly string[],
  today: string,
): CardPayment[] {
  const terms = card.card;
  if (terms === undefined) return [];
  return months.flatMap((month) => {
    const cycle = invoiceCycleOf(dayOfMonth(month, terms.closingDay - 1 || 1), terms);
    const owed = -transactions
      .filter(
        (transaction) =>
          transaction.accountId === card.id &&
          transaction.date >= cycle.startsOn &&
          transaction.date < cycle.closesOn,
      )
      .reduce((total, transaction) => total + transaction.amountCents, 0);
    if (owed <= 0 || cycle.dueOn > today) return [];
    return [
      {
        id: `demo-payment-${cycle.dueOn}`,
        cardId: card.id,
        fromAccountId: DEMO_CHECKING,
        date: cycle.dueOn,
        amountCents: owed,
      },
    ];
  });
}

/** Bills of the last month and the next three: paid ones until today, the rest open, and one gone overdue. */
function buildBills(today: string, word: (key: string) => string): Bill[] {
  const recurring = [
    {
      slug: 'salary',
      key: 'salary',
      kind: 'receivable',
      category: 'salary',
      day: 5,
      cents: SALARY_CENTS,
    },
    { slug: 'rent', key: 'rent', kind: 'payable', category: 'housing', day: 8, cents: 210_000 },
    { slug: 'condo', key: 'condo', kind: 'payable', category: 'housing', day: 10, cents: 42_000 },
    {
      slug: 'internet',
      key: 'internet',
      kind: 'payable',
      category: 'subscriptions',
      day: 15,
      cents: 11_990,
    },
    { slug: 'energy', key: 'energy', kind: 'payable', category: 'housing', day: 20, cents: 19_000 },
  ] as const;
  const months = Array.from({ length: 5 }, (_, index) => addMonths(today, index - 1));
  const bills: Bill[] = months.flatMap((month) =>
    recurring.map((item): Bill => {
      const dueDate = dayOfMonth(month, item.day);
      const isOverdue = item.slug === 'condo' && dueDate < today && dueDate >= addDays(today, -25);
      return {
        id: `demo-bill-${item.slug}-${month}`,
        kind: item.kind,
        description: word(item.key),
        categoryId: item.category,
        amountCents: item.cents,
        dueDate,
        settlement:
          dueDate <= today && !isOverdue ? { date: dueDate, accountId: DEMO_CHECKING } : undefined,
      };
    }),
  );
  const monthly = months.map((month, index) => ({ month, number: index + 1 }));
  const installments: Bill[] = monthly.map(({ month, number }) => ({
    id: `demo-bill-course-${month}`,
    kind: 'payable',
    description: word('course'),
    categoryId: 'education',
    amountCents: 35_000,
    dueDate: dayOfMonth(month, 25),
    settlement:
      dayOfMonth(month, 25) <= today
        ? { date: dayOfMonth(month, 25), accountId: DEMO_CARD }
        : undefined,
    series: { seriesId: 'demo-course', recurrence: 'installments', number: number + 6, count: 12 },
  }));
  const freelance: Bill = {
    id: 'demo-bill-freelance',
    kind: 'receivable',
    description: word('freelance'),
    categoryId: 'extra-income',
    amountCents: 150_000,
    dueDate: addDays(today, 6),
  };
  return [...bills, ...installments, freelance];
}

function buildPrices(firstMonth: string): Record<string, number[]> {
  return Object.fromEntries(
    INVESTMENTS.map((investment, position) => {
      const next = random(1000 + position * 7919 + monthSeed(firstMonth));
      const series = [investment.price];
      for (let month = 1; month < PRICE_MONTHS; month++) {
        const wiggle = (next() - 0.5) * (investment.kind === 'fixedIncome' ? 0.002 : 0.09);
        series.push(Math.max(1, Math.round(series[month - 1] * (1 + investment.drift + wiggle))));
      }
      return [investment.id, series];
    }),
  );
}

/** What the purchases of a `YYYY-MM` month came to, which the month's transfer to investments matches. */
function investedIn(trades: readonly Trade[], month: string): number {
  return trades
    .filter((trade) => trade.kind === 'buy' && trade.date.slice(0, 7) === month)
    .reduce(
      (total, trade) =>
        total + Math.round((trade.quantityThousandths * trade.unitPriceCents) / 1000),
      0,
    );
}

/** A little bought every month (more of the steady ones), one sale, FII yields monthly and dividends each quarter. */
function buildInvestmentActivity(
  months: readonly string[],
  today: string,
  prices: Record<string, number[]>,
  firstPriceMonth: string,
): { trades: Trade[]; incomes: Income[] } {
  const priceIn = (id: string, month: string): number =>
    prices[id][
      Math.max(0, Math.min(PRICE_MONTHS - 1, monthSeed(month) - monthSeed(firstPriceMonth)))
    ];
  const trades: Trade[] = [];
  const incomes: Income[] = [];
  months.forEach((month, step) => {
    const next = random(77 + monthSeed(month));
    const bought = [0, 1, 2].map((offset) => INVESTMENTS[(step * 3 + offset) % INVESTMENTS.length]);
    for (const investment of bought) {
      const price = priceIn(investment.id, month);
      const quantity =
        investment.kind === 'fixedIncome' ? 0.05 : Math.max(1, Math.round(120_000 / price));
      const date = dayOfMonth(month, 6 + Math.floor(next() * 4));
      if (date <= today) {
        trades.push({
          id: `demo-trade-${trades.length}`,
          investmentId: investment.id,
          date,
          kind: 'buy',
          quantityThousandths:
            investment.kind === 'fixedIncome' ? Math.round(quantity * 1000) : units(quantity),
          unitPriceCents: price,
        });
      }
    }
  });
  const sale = trades.find((trade) => trade.investmentId === 'demo-petr4');
  if (sale !== undefined && sale.date < addMonths(today, -3)) {
    trades.push({
      ...sale,
      id: 'demo-trade-sale',
      date: dayOfMonth(addMonths(today, -3), 12),
      kind: 'sell',
      quantityThousandths: Math.floor(sale.quantityThousandths / 2),
    });
  }
  for (const month of months) {
    const day = dayOfMonth(month, 14);
    for (const investment of INVESTMENTS.filter(
      (item) =>
        item.kind === 'realEstateFund' || (item.kind === 'stock' && monthSeed(month) % 3 === 0),
    )) {
      const quantity = trades
        .filter((trade) => trade.investmentId === investment.id && trade.date < day)
        .reduce(
          (total, trade) =>
            total + (trade.kind === 'buy' ? trade.quantityThousandths : -trade.quantityThousandths),
          0,
        );
      const perUnit =
        priceIn(investment.id, month) * (investment.kind === 'realEstateFund' ? 0.0075 : 0.012);
      const amount = Math.round((quantity / 1000) * perUnit);
      if (day <= today && amount > 0) {
        incomes.push({
          id: `demo-income-${incomes.length}`,
          investmentId: investment.id,
          date: day,
          kind: investment.kind === 'realEstateFund' ? 'yield' : 'interestOnEquity',
          amountCents: amount,
        });
      }
    }
  }
  return { trades, incomes };
}

/**
 * The price of one unit of an investment on a day, from the made-up price series; the last known price
 * after its end and undefined for an unknown investment.
 * @example priceOnDay(data, 'demo-petr4', '2026-11-04')
 */
export function priceOnDay(
  data: Pick<DemoData, 'prices' | 'firstPriceMonth'>,
  investmentId: string,
  day: string,
): number | undefined {
  const series = data.prices[investmentId];
  if (series === undefined) return undefined;
  const index = monthSeed(day.slice(0, 7)) - monthSeed(data.firstPriceMonth);
  return series[Math.max(0, Math.min(series.length - 1, index))];
}
