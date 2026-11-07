import { LOCALE_ID, Injectable, inject } from '@angular/core';
import { Clock } from '../../calendar/clock';
import { isoDate } from '../../calendar/date-label';
import { AccountStatement, CardPayment } from '../account-statement';
import { Bill, BillDraft, BillsAgenda, CardInvoiceDue } from '../bills';
import { Account, FinanceCategory } from '../finance-references';
import { IncomeSplit } from '../income-split';
import { Income, Investment, Portfolio, Trade } from '../investments';
import { NetWorthPoint } from '../net-worth';
import { Transaction } from '../transaction';
import { addDays, addMonths, dayOfMonth, monthEnd } from './demo-dates';
import { DemoData, buildDemoData, priceOnDay } from './demo-data';
import { portfolioAt } from './demo-portfolio';
import { statementsAt } from './demo-statements';

/** How many days back a settled bill still shows in the agenda. */
const SETTLED_DAYS = 30;
const NET_WORTH_MONTHS = 12;

/**
 * The made-up Finances data the demo screens work on, kept in memory for as long as the page is open: what
 * is added, changed or deleted in the demo stays until the page is reloaded, then starts again as it was.
 * Every figure the screens show (balances, invoices, the portfolio) is worked out from it, as the API does.
 */
@Injectable({ providedIn: 'root' })
export class DemoFinances {
  /** Today, `YYYY-MM-DD`. */
  readonly today = isoDate(inject(Clock).now());

  categories: FinanceCategory[];
  accounts: Account[];
  transactions: Transaction[];
  payments: CardPayment[];
  bills: Bill[];
  split: IncomeSplit;
  investments: Investment[];
  trades: Trade[];
  incomes: Income[];
  private readonly seed: DemoData;

  constructor() {
    const language = inject(LOCALE_ID) === 'pt-BR' ? 'pt-BR' : 'en-US';
    this.seed = buildDemoData(this.today, language);
    this.categories = [...this.seed.categories];
    this.accounts = [...this.seed.accounts];
    this.transactions = [...this.seed.transactions];
    this.payments = [...this.seed.payments];
    this.bills = [...this.seed.bills];
    this.split = this.seed.split;
    this.investments = [...this.seed.investments];
    this.trades = [...this.seed.trades];
    this.incomes = [...this.seed.incomes];
  }

  /** The transactions of a `YYYY-MM` month, newest day first. */
  transactionsIn(month: string): Transaction[] {
    return this.transactions
      .filter((transaction) => transaction.date.slice(0, 7) === month)
      .sort((first, second) => second.date.localeCompare(first.date));
  }

  paymentsIn(month: string): CardPayment[] {
    return this.payments
      .filter((payment) => payment.date.slice(0, 7) === month)
      .sort((first, second) => second.date.localeCompare(first.date));
  }

  statements(asOf: string): AccountStatement[] {
    return statementsAt(this.accounts, this.transactions, this.payments, asOf);
  }

  portfolio(asOf: string): Portfolio {
    return portfolioAt({
      investments: this.investments,
      trades: this.trades,
      incomes: this.incomes,
      priceOn: (investmentId, day) => priceOnDay(this.seed, investmentId, day),
      asOf,
    });
  }

  /** The open bills, the ones settled in the last 30 days, and the card invoices left to pay. */
  agenda(asOf: string): BillsAgenda {
    const since = addDays(asOf, -SETTLED_DAYS);
    const bills = this.bills.filter(
      (bill) => bill.settlement === undefined || bill.settlement.date >= since,
    );
    return { bills, cardInvoices: this.invoicesToPay(asOf) };
  }

  /**
   * Creates a bill, with every occurrence when it repeats, or replaces the open one with the same id.
   * @example demo.saveBill('rent', { kind: 'payable', description: 'Rent', categoryId: 'housing', amountCents: 150000, dueDate: '2026-11-05', repeat: { kind: 'monthly', count: 12 } })
   */
  saveBill(billId: string, draft: BillDraft): Bill[] {
    const { repeat, ...fields } = draft;
    const count = repeat?.count ?? 1;
    const made = Array.from({ length: count }, (_, index): Bill => {
      const series =
        repeat === undefined
          ? undefined
          : { seriesId: billId, recurrence: repeat.kind, number: index + 1, count };
      const step = repeat?.kind === 'yearly' ? 12 : 1;
      const dueDate = dayOfMonth(
        addMonths(draft.dueDate, index * step),
        Number(draft.dueDate.slice(8, 10)),
      );
      return { ...fields, id: index === 0 ? billId : `${billId}-${index + 1}`, dueDate, series };
    });
    this.bills = [
      ...this.bills.filter((bill) => !made.some((item) => item.id === bill.id)),
      ...made,
    ];
    return made;
  }

  /** Marks the bill paid or received and records the transaction it comes to. */
  settleBill(billId: string, settlement: NonNullable<Bill['settlement']>): Bill | undefined {
    const bill = this.bills.find((candidate) => candidate.id === billId);
    if (bill === undefined) return undefined;
    const settled = { ...bill, settlement };
    this.bills = this.bills.map((candidate) => (candidate.id === billId ? settled : candidate));
    this.transactions = [
      ...this.transactions.filter((transaction) => transaction.id !== settleTransactionId(billId)),
      {
        id: settleTransactionId(billId),
        date: settlement.date,
        description: bill.description,
        categoryId: bill.categoryId,
        accountId: settlement.accountId,
        amountCents: bill.kind === 'payable' ? -bill.amountCents : bill.amountCents,
      },
    ];
    return settled;
  }

  /** Undoes a settlement and removes the transaction it recorded. */
  reopenBill(billId: string): Bill | undefined {
    const bill = this.bills.find((candidate) => candidate.id === billId);
    if (bill === undefined) return undefined;
    const reopened = { ...bill, settlement: undefined };
    this.bills = this.bills.map((candidate) => (candidate.id === billId ? reopened : candidate));
    this.transactions = this.transactions.filter(
      (transaction) => transaction.id !== settleTransactionId(billId),
    );
    return reopened;
  }

  /** The net worth at the end of each of the last twelve months, from balances, invoices and the portfolio. */
  netWorthHistory(): NetWorthPoint[] {
    const history = this.portfolio(this.today).history ?? [];
    return Array.from({ length: NET_WORTH_MONTHS }, (_, index) =>
      addMonths(this.today, index + 1 - NET_WORTH_MONTHS),
    ).map((month) => {
      const end = month === this.today.slice(0, 7) ? this.today : monthEnd(month);
      const worth = this.statements(end).reduce(
        (total, statement) => total + statement.balanceCents,
        0,
      );
      const invested = history.find((point) => point.month === month)?.valueCents ?? 0;
      return { month, cents: worth + invested };
    });
  }

  private invoicesToPay(asOf: string): CardInvoiceDue[] {
    return this.statements(asOf).flatMap((statement): CardInvoiceDue[] => {
      const card = statement.card;
      if (card === undefined) return [];
      const due: CardInvoiceDue[] = [];
      if (card.amountDueCents > 0) {
        due.push({
          cardId: statement.accountId,
          dueOn: card.closedInvoice.dueOn,
          amountCents: card.amountDueCents,
          isClosed: true,
        });
      }
      if (card.openInvoice.amountCents > 0) {
        due.push({
          cardId: statement.accountId,
          dueOn: card.openInvoice.dueOn,
          amountCents: card.openInvoice.amountCents,
          isClosed: false,
        });
      }
      return due;
    });
  }
}

function settleTransactionId(billId: string): string {
  return `demo-settle-${billId}`;
}
