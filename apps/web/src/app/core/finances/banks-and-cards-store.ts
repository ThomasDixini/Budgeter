import { ErrorHandler, Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { Clock } from '../calendar/clock';
import { isoDate } from '../calendar/date-label';
import { IdGenerator } from '../ids/id-generator';
import { positionOf, restoredAt, sameId } from '../lists/list-positions';
import { AccountStatement, CardPayment, CardPaymentDraft } from './account-statement';
import { AccountStatementsGateway } from './account-statements-gateway';
import { Account, AccountDraft } from './finance-references';
import { FinanceReferencesStore } from './finance-references-store';
import { Transaction } from './transaction';
import { monthOfDay, shiftMonth } from './transaction-month';
import { TransactionsGateway } from './transactions-gateway';

/**
 * What the Banks & Cards page shows: where each account stands today, the transactions around this
 * month (a card's open invoice can start last month or close next month) and this month's card
 * payments. Provided by the page, so each visit loads fresh balances. Balances are worked out by the
 * API, so they are asked for again once a change is stored.
 */
@Injectable()
export class BanksAndCardsStore {
  private readonly references = inject(FinanceReferencesStore);
  private readonly transactionsGateway = inject(TransactionsGateway);
  private readonly gateway = inject(AccountStatementsGateway);
  private readonly ids = inject(IdGenerator);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly statementList = signal<readonly AccountStatement[]>([]);
  private readonly transactionList = signal<readonly Transaction[]>([]);
  private readonly paymentList = signal<readonly CardPayment[]>([]);
  private readonly statementsLoaded = signal(false);
  private readonly activityLoaded = signal(false);
  private readonly loadFailed = signal(false);
  /** Counts statement requests, so an answer overtaken by a newer one is dropped. */
  private statementsRequest = 0;

  /** Today, `YYYY-MM-DD`: balances and lists count what is dated up to it. */
  readonly today = isoDate(inject(Clock).now());
  /** The `YYYY-MM` month whose movements bank accounts show. */
  readonly month = monthOfDay(this.today);
  readonly accounts = this.references.accounts;
  readonly categories = this.references.categories;
  readonly transactions = this.transactionList.asReadonly();
  readonly payments = this.paymentList.asReadonly();
  readonly statements = computed(
    () => new Map(this.statementList().map((statement) => [statement.accountId, statement])),
  );
  readonly isLoaded = computed(
    () => this.statementsLoaded() && this.activityLoaded() && this.references.isLoaded(),
  );
  readonly hasLoadFailed = computed(() => this.loadFailed() || this.references.hasLoadFailed());

  constructor() {
    this.loadStatements();
    this.loadActivity();
  }

  /**
   * Loads again whatever did not arrive, after a failed load.
   * @example store.reload()
   */
  reload(): void {
    this.references.reload();
    this.loadFailed.set(false);
    if (!this.statementsLoaded()) this.loadStatements();
    if (!this.activityLoaded()) this.loadActivity();
  }

  /** @example store.addAccount({ name: 'Nubank', kind: 'bankAccount', openingBalanceCents: 0 }) */
  addAccount(draft: AccountDraft): Account {
    return this.references.addAccount(draft, () => this.loadStatements());
  }

  /** @example store.updateAccount('credit-card', { ...card, name: 'Visa' }) */
  updateAccount(accountId: string, draft: AccountDraft): Account | undefined {
    return this.references.updateAccount(accountId, draft, () => this.loadStatements());
  }

  /** @example store.deleteAccount('old-card') */
  deleteAccount(accountId: string): void {
    this.references.deleteAccount(accountId, () => this.loadStatements());
  }

  /**
   * Records a card invoice payment; it lists at once when dated this month, and the balances follow
   * once it is stored. Dropped again if the gateway rejects it.
   * @example store.payInvoice({ cardId: 'credit-card', fromAccountId: 'checking-account', date: '2026-11-10', amountCents: 28640 })
   */
  payInvoice(draft: CardPaymentDraft): CardPayment {
    const payment: CardPayment = { ...draft, id: this.ids.next() };
    if (monthOfDay(payment.date) === this.month)
      this.paymentList.update((list) => [payment, ...list]);
    this.gateway.savePayment(payment).subscribe({
      next: () => this.loadStatements(),
      error: (error: unknown) => {
        this.paymentList.update((list) => list.filter((current) => current !== payment));
        this.errorHandler.handleError(error);
      },
    });
    return payment;
  }

  /**
   * Deletes a card payment; puts it back in place if the gateway rejects it.
   * @example store.deletePayment('september-invoice')
   */
  deletePayment(paymentId: string): void {
    const removed = positionOf(this.paymentList(), (current) => current.id === paymentId);
    this.paymentList.update((list) => list.filter((current) => current.id !== paymentId));
    this.gateway.deletePayment(paymentId).subscribe({
      next: () => this.loadStatements(),
      error: (error: unknown) => {
        if (removed !== undefined)
          this.paymentList.update((list) => restoredAt(list, removed, sameId));
        this.errorHandler.handleError(error);
      },
    });
  }

  private loadStatements(): void {
    const request = ++this.statementsRequest;
    this.gateway.statements(this.today).subscribe({
      next: (statements) => {
        if (request !== this.statementsRequest) return;
        this.statementList.set(statements);
        this.statementsLoaded.set(true);
      },
      error: (error: unknown) => {
        if (request !== this.statementsRequest) return;
        // Balances from before a change are no longer right: drop them so "try again" asks anew.
        this.statementsLoaded.set(false);
        this.failedToLoad(error);
      },
    });
  }

  private loadActivity(): void {
    const months = [shiftMonth(this.month, -1), this.month, shiftMonth(this.month, 1)];
    forkJoin({
      transactions: forkJoin(months.map((month) => this.transactionsGateway.listMonth(month))),
      payments: this.gateway.paymentsInMonth(this.month),
    }).subscribe({
      next: ({ transactions, payments }) => {
        this.transactionList.set(transactions.flat());
        this.paymentList.set(payments);
        this.activityLoaded.set(true);
      },
      error: (error: unknown) => this.failedToLoad(error),
    });
  }

  private failedToLoad(error: unknown): void {
    this.loadFailed.set(true);
    this.errorHandler.handleError(error);
  }
}
