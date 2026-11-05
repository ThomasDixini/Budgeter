import { ErrorHandler, Injectable, computed, inject, signal } from '@angular/core';
import { Clock } from '../calendar/clock';
import { IdGenerator } from '../ids/id-generator';
import { Positioned, positionOf, restoredAt, sameId } from '../lists/list-positions';
import { FinanceReferencesStore } from './finance-references-store';
import { Transaction, TransactionDraft } from './transaction';
import { monthOf, monthOfDay } from './transaction-month';
import { TransactionsGateway } from './transactions-gateway';

/**
 * The transactions of the month on screen, with the categories and accounts they refer to (shared
 * with the other Finances pages). Mutations apply locally first and roll back if the gateway rejects
 * them, without undoing what changed in the meantime; the server's answer is never applied over the
 * list, so a slow answer cannot overwrite a newer edit.
 */
@Injectable({ providedIn: 'root' })
export class TransactionsStore {
  private readonly gateway = inject(TransactionsGateway);
  private readonly references = inject(FinanceReferencesStore);
  private readonly ids = inject(IdGenerator);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly shownMonth = signal(monthOf(inject(Clock).now()));
  private readonly transactionList = signal<readonly Transaction[]>([]);
  private readonly monthLoaded = signal(false);
  private readonly monthFailed = signal(false);
  private readonly lastAccount = signal<string | undefined>(undefined);

  /** The `YYYY-MM` month the list holds. */
  readonly month = this.shownMonth.asReadonly();
  readonly transactions = this.transactionList.asReadonly();
  readonly categories = this.references.categories;
  readonly accounts = this.references.accounts;
  /** The account of the last transaction added or edited, offered first on the next one. */
  readonly lastAccountId = this.lastAccount.asReadonly();
  /** Whether everything arrived, so "empty" can be told apart from "still loading". */
  readonly isLoaded = computed(() => this.monthLoaded() && this.references.isLoaded());
  /** Whether loading failed with nothing on its way, so the page can offer to try again. */
  readonly hasLoadFailed = computed(() => this.monthFailed() || this.references.hasLoadFailed());

  constructor() {
    this.loadMonth(this.shownMonth());
  }

  /**
   * Shows another month: its transactions replace the list once they arrive.
   * @example store.showMonth('2026-09')
   */
  showMonth(month: string): void {
    if (month === this.shownMonth()) return;
    this.shownMonth.set(month);
    this.transactionList.set([]);
    this.monthLoaded.set(false);
    this.monthFailed.set(false);
    this.loadMonth(month);
  }

  /**
   * Loads again whatever did not arrive, after a failed load; what did arrive is kept.
   * @example store.reload()
   */
  reload(): void {
    this.references.reload();
    this.monthFailed.set(false);
    if (!this.monthLoaded()) this.loadMonth(this.shownMonth());
  }

  /**
   * Records a transaction. It shows at the top of its day when it belongs to the month on screen;
   * one dated in another month is saved without showing.
   * @example store.add({ date: '2026-10-31', description: 'Groceries', categoryId: 'food', accountId: 'credit-card', amountCents: -28640 })
   */
  add(draft: TransactionDraft): Transaction {
    const transaction: Transaction = { ...draft, id: this.ids.next() };
    this.lastAccount.set(draft.accountId);
    if (this.isShown(transaction)) this.transactionList.update((list) => [transaction, ...list]);
    // Removed only while it is still the version added: an edit since then is saved by its own request.
    const dropAdded = (): void =>
      this.transactionList.update((list) => list.filter((current) => current !== transaction));
    this.gateway.save(transaction).subscribe({
      error: (error: unknown) => this.rejected(error, dropAdded),
    });
    return transaction;
  }

  /**
   * Edits a transaction in place; moved to another month, it leaves the list. A failed save puts the
   * previous version back only if this edit is still the one shown (or it left the month).
   * @example store.update('groceries', { ...groceries, amountCents: -30000 })
   */
  update(transactionId: string, draft: TransactionDraft): Transaction | undefined {
    const previous = positionOf(this.transactionList(), (current) => current.id === transactionId);
    if (previous === undefined) return undefined;
    const transaction: Transaction = { ...draft, id: transactionId };
    this.lastAccount.set(draft.accountId);
    this.transactionList.update((list) =>
      this.isShown(transaction)
        ? list.map((current) => (current.id === transactionId ? transaction : current))
        : list.filter((current) => current.id !== transactionId),
    );
    this.gateway.save(transaction).subscribe({
      error: (error: unknown) => this.rejected(error, () => this.undoEdit(transaction, previous)),
    });
    return transaction;
  }

  /**
   * Deletes a transaction; puts it back in place if the gateway rejects it.
   * @example store.delete('groceries')
   */
  delete(transactionId: string): void {
    const removed = positionOf(this.transactionList(), (current) => current.id === transactionId);
    this.transactionList.update((list) => list.filter((current) => current.id !== transactionId));
    this.gateway.delete(transactionId).subscribe({
      error: (error: unknown) => this.rejected(error, () => this.putBack(removed)),
    });
  }

  private loadMonth(month: string): void {
    // An answer for a month no longer on screen must neither fill the list nor report a failure.
    this.gateway.listMonth(month).subscribe({
      next: (transactions) => {
        if (this.shownMonth() !== month) return;
        this.transactionList.set(transactions);
        this.monthLoaded.set(true);
      },
      error: (error: unknown) => {
        if (this.shownMonth() !== month) return;
        this.monthFailed.set(true);
        this.errorHandler.handleError(error);
      },
    });
  }

  private undoEdit(saved: Transaction, previous: Positioned<Transaction>): void {
    const list = this.transactionList();
    if (list.includes(saved)) {
      this.transactionList.set(
        list.map((current) => (current === saved ? previous.record : current)),
      );
      return;
    }
    // Gone from the list because the edit moved it to another month (a deletion keeps it gone).
    if (!this.isShown(saved)) this.putBack(previous);
  }

  private putBack(removed: Positioned<Transaction> | undefined): void {
    if (removed === undefined || !this.isShown(removed.record)) return;
    this.transactionList.update((list) => restoredAt(list, removed, sameId));
  }

  private isShown(transaction: Transaction): boolean {
    return monthOfDay(transaction.date) === this.shownMonth();
  }

  private rejected(error: unknown, rollback: () => void): void {
    rollback();
    this.errorHandler.handleError(error);
  }
}
