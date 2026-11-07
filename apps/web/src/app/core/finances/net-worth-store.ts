import { ErrorHandler, Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { Clock } from '../calendar/clock';
import { isoDate } from '../calendar/date-label';
import { AccountStatement } from './account-statement';
import { AccountStatementsGateway } from './account-statements-gateway';
import { FinanceReferencesStore } from './finance-references-store';
import { Portfolio } from './investments';
import { InvestmentsGateway } from './investments-gateway';
import { NetWorthPoint, netWorth } from './net-worth';

/**
 * Where the net worth of each month comes from, once something keeps it. Nothing does yet, so it is only
 * provided by the demo; without it the history stays empty.
 */
export const NET_WORTH_HISTORY = new InjectionToken<() => readonly NetWorthPoint[]>(
  'NET_WORTH_HISTORY',
);

/**
 * What the Net worth page shows, put together from data that already exists: today's balances and the
 * investments held. Provided by the page, so each visit loads fresh data; nothing is changed from here.
 */
@Injectable()
export class NetWorthStore {
  private readonly references = inject(FinanceReferencesStore);
  private readonly statementsGateway = inject(AccountStatementsGateway);
  private readonly investmentsGateway = inject(InvestmentsGateway);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly historySource = inject(NET_WORTH_HISTORY, { optional: true });
  private readonly statementList = signal<readonly AccountStatement[]>([]);
  private readonly portfolio = signal<Portfolio | undefined>(undefined);
  private readonly loadFailed = signal(false);

  /** Today, `YYYY-MM-DD`. */
  readonly today = isoDate(inject(Clock).now());
  readonly isLoaded = computed(() => this.portfolio() !== undefined && this.references.isLoaded());
  readonly hasLoadFailed = computed(() => this.loadFailed() || this.references.hasLoadFailed());
  /** How many held investments are valued at cost for lack of a price. */
  readonly unpricedCount = computed(() => this.portfolio()?.totals.unpricedCount ?? 0);
  /**
   * The net worth at the end of each month. Nothing keeps it yet, so it is empty and the evolution chart
   * and the monthly table say so; it is the one place to feed once month-end balances are stored.
   */
  readonly history = computed<readonly NetWorthPoint[]>(() => this.historySource?.() ?? []);
  readonly netWorth = computed(() => {
    const balances = new Map(
      this.statementList().map((statement) => [statement.accountId, statement.balanceCents]),
    );
    const held = (this.portfolio()?.lines ?? []).map((line) => ({
      id: line.investment.id,
      name: line.investment.name,
      valueCents: line.valueCents ?? line.costCents,
    }));
    return netWorth(this.references.accounts(), balances, held);
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
    if (!this.isLoaded()) this.load();
  }

  private load(): void {
    forkJoin({
      statements: this.statementsGateway.statements(this.today),
      portfolio: this.investmentsGateway.portfolio(this.today),
    }).subscribe({
      next: ({ statements, portfolio }) => {
        this.statementList.set(statements);
        this.portfolio.set(portfolio);
      },
      error: (error: unknown) => {
        this.loadFailed.set(true);
        this.errorHandler.handleError(error);
      },
    });
  }
}
