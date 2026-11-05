import { ErrorHandler, Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { Clock } from '../calendar/clock';
import { isoDate } from '../calendar/date-label';
import { AccountStatement } from './account-statement';
import { AccountStatementsGateway } from './account-statements-gateway';
import { accountTotals } from './account-activity';
import { BillsAgenda, billItem, invoiceItem } from './bills';
import { BillsGateway } from './bills-gateway';
import { namesById } from './finance-references';
import { FinanceReferencesStore } from './finance-references-store';
import {
  LATEST_TRANSACTIONS,
  UPCOMING_DUES,
  flowMonths,
  flowPeak,
  latestTransactions,
  monthlyFlow,
  spendingByCategory,
  upcomingDues,
} from './overview';
import { Transaction } from './transaction';
import { monthOfDay } from './transaction-month';
import { TransactionsGateway } from './transactions-gateway';

const NO_AGENDA: BillsAgenda = { bills: [], cardInvoices: [] };

/**
 * What the Finances Overview shows, put together from data that already exists: today's balances, the
 * transactions of the last months and the bills to pay and receive. Provided by the page, so each visit
 * loads fresh data; nothing is changed from here.
 */
@Injectable()
export class OverviewStore {
  private readonly references = inject(FinanceReferencesStore);
  private readonly statementsGateway = inject(AccountStatementsGateway);
  private readonly transactionsGateway = inject(TransactionsGateway);
  private readonly billsGateway = inject(BillsGateway);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly statementList = signal<readonly AccountStatement[]>([]);
  private readonly monthTransactions = signal<readonly (readonly Transaction[])[]>([]);
  private readonly agenda = signal<BillsAgenda>(NO_AGENDA);
  private readonly dataLoaded = signal(false);
  private readonly loadFailed = signal(false);

  /** Today, `YYYY-MM-DD`. */
  readonly today = isoDate(inject(Clock).now());
  readonly month = monthOfDay(this.today);
  readonly months = flowMonths(this.month);
  readonly accounts = this.references.accounts;
  readonly categoryNames = computed(() => namesById(this.references.categories()));
  readonly accountNames = computed(() => namesById(this.references.accounts()));
  readonly isLoaded = computed(() => this.dataLoaded() && this.references.isLoaded());
  readonly hasLoadFailed = computed(() => this.loadFailed() || this.references.hasLoadFailed());

  readonly totals = computed(() =>
    accountTotals(
      this.accounts(),
      new Map(
        this.statementList().map((statement) => [statement.accountId, statement.balanceCents]),
      ),
    ),
  );
  readonly flow = computed(() => monthlyFlow(this.months, this.monthTransactions()));
  readonly flowPeak = computed(() => flowPeak(this.flow()));
  readonly thisMonth = computed(() => this.flow()[this.flow().length - 1]);
  readonly spending = computed(() =>
    spendingByCategory(this.monthTransactions().at(-1) ?? [], this.categoryNames()),
  );
  readonly latest = computed(() =>
    latestTransactions(this.monthTransactions().slice(-2).flat(), LATEST_TRANSACTIONS),
  );
  readonly dues = computed(() => {
    const agenda = this.agenda();
    const cardNames = this.accountNames();
    const items = [
      ...agenda.bills.map(billItem),
      ...agenda.cardInvoices.map((invoice) =>
        invoiceItem(invoice, cardNames.get(invoice.cardId) ?? 'Card'),
      ),
    ];
    return upcomingDues(items, this.today, UPCOMING_DUES);
  });

  constructor() {
    this.load();
  }

  /**
   * Loads everything again, after a failed load.
   * @example store.reload()
   */
  reload(): void {
    this.references.reload();
    this.loadFailed.set(false);
    if (!this.dataLoaded()) this.load();
  }

  private load(): void {
    forkJoin({
      statements: this.statementsGateway.statements(this.today),
      transactions: forkJoin(this.months.map((month) => this.transactionsGateway.listMonth(month))),
      agenda: this.billsGateway.agenda(this.today),
    }).subscribe({
      next: ({ statements, transactions, agenda }) => {
        this.statementList.set(statements);
        this.monthTransactions.set(transactions);
        this.agenda.set(agenda);
        this.dataLoaded.set(true);
      },
      error: (error: unknown) => {
        this.loadFailed.set(true);
        this.errorHandler.handleError(error);
      },
    });
  }
}
