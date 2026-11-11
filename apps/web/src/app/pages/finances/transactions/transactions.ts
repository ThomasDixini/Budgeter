import { Component, LOCALE_ID, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LoadFailed } from '../../../components/load-failed/load-failed';
import { PageHeading } from '../../../components/page-heading/page-heading';
import { Clock } from '../../../core/calendar/clock';
import { isoDate } from '../../../core/calendar/date-label';
import { namesById } from '../../../core/finances/finance-references';
import { Transaction, TransactionDraft } from '../../../core/finances/transaction';
import { groupByDay } from '../../../core/finances/transaction-days';
import {
  NO_FILTERS,
  TransactionFilters,
  filterTransactions,
} from '../../../core/finances/transaction-filters';
import {
  defaultDayIn,
  monthLabel,
  monthOfDay,
  shiftMonth,
} from '../../../core/finances/transaction-month';
import { summarize } from '../../../core/finances/transaction-summary';
import { TransactionsStore } from '../../../core/finances/transactions-store';
import { FiltersBar } from './filters-bar/filters-bar';
import { MonthSummary } from './month-summary/month-summary';
import { ImportResult, StatementImport } from './statement-import/statement-import';
import { TransactionForm } from './transaction-form/transaction-form';
import { TransactionHistory } from './transaction-history/transaction-history';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

/** Finances landing page: the month's totals and transactions, with filters and a quick-entry form. */
@Component({
  selector: 'app-finances-transactions',
  imports: [
    RouterLink,
    TranslatePipe,
    PageHeading,
    LoadFailed,
    MonthSummary,
    FiltersBar,
    TransactionHistory,
    TransactionForm,
    StatementImport,
  ],
  templateUrl: './transactions.html',
  styleUrl: './transactions.css',
})
export class Transactions {
  private readonly store = inject(TransactionsStore);
  private readonly clock = inject(Clock);
  private readonly locale = inject(LOCALE_ID);

  protected readonly categories = this.store.categories;
  protected readonly accounts = this.store.accounts;
  protected readonly isLoaded = this.store.isLoaded;
  protected readonly hasLoadFailed = this.store.hasLoadFailed;
  protected readonly filters = signal<TransactionFilters>(NO_FILTERS);
  protected readonly isFormOpen = signal(false);
  protected readonly isImportOpen = signal(false);
  /** What the last import came to, shown until the person moves on. */
  protected readonly importResult = signal<ImportResult | undefined>(undefined);
  /** The transaction open in the form; none while recording a new one. */
  protected readonly editing = signal<Transaction | undefined>(undefined);
  /** Says where a transaction dated in another month went, since it does not show in this one. */
  protected readonly savedElsewhere = signal<string | undefined>(undefined);

  protected readonly monthTitle = computed(() => monthLabel(this.store.month(), this.locale));
  protected readonly categoryNames = computed(() => namesById(this.categories()));
  protected readonly accountNames = computed(() => namesById(this.accounts()));
  private readonly shown = computed(() =>
    filterTransactions(this.store.transactions(), this.filters(), this.categoryNames()),
  );
  protected readonly summary = computed(() => summarize(this.shown()));
  protected readonly days = computed(() => groupByDay(this.shown()));
  protected readonly isFiltered = computed(() => {
    const filters = this.filters();
    return filters.type !== 'all' || filters.accountId !== undefined || filters.query.trim() !== '';
  });
  /** A transaction needs a category and an account, so the form waits until both lists arrived. */
  protected readonly canRecord = computed(
    () => this.categories().length > 0 && this.accounts().length > 0,
  );
  protected readonly defaultDate = computed(() =>
    defaultDayIn(this.store.month(), isoDate(this.clock.now())),
  );
  protected readonly defaultAccountId = computed(
    () => this.store.lastAccountId() ?? this.accounts()[0]?.id,
  );

  /**
   * Moves the list one month back (-1) or forward (1); the filters stay as they are.
   * @example this.showMonth(-1)
   */
  protected showMonth(step: number): void {
    this.closeForm();
    this.savedElsewhere.set(undefined);
    this.store.showMonth(shiftMonth(this.store.month(), step));
  }

  protected openImport(): void {
    this.closeForm();
    this.importResult.set(undefined);
    this.isImportOpen.set(true);
  }

  /** Closes the panel and shows the month the lines went to, where they can be checked. */
  protected finishImport(result: ImportResult): void {
    this.isImportOpen.set(false);
    this.importResult.set(result);
    if (result.month !== '') this.store.showMonth(result.month);
  }

  protected openNew(): void {
    this.isImportOpen.set(false);
    this.editing.set(undefined);
    this.isFormOpen.set(true);
  }

  protected openEdit(transaction: Transaction): void {
    this.editing.set(transaction);
    this.isFormOpen.set(true);
  }

  protected closeForm(): void {
    this.isFormOpen.set(false);
    this.editing.set(undefined);
  }

  /**
   * Records the form's transaction, or saves the edit of the one open in it.
   * @example this.save({ date: '2026-10-31', description: 'Groceries', categoryId: 'food', accountId: 'credit-card', amountCents: -28640 })
   */
  protected save(draft: TransactionDraft): void {
    const editing = this.editing();
    if (editing === undefined) this.store.add(draft);
    else this.store.update(editing.id, draft);
    this.closeForm();
    this.announceIfElsewhere(draft.date);
  }

  protected remove(): void {
    const editing = this.editing();
    if (editing !== undefined) this.store.delete(editing.id);
    this.closeForm();
  }

  protected reload(): void {
    this.store.reload();
  }

  private announceIfElsewhere(isoDay: string): void {
    const month = monthOfDay(isoDay);
    this.savedElsewhere.set(
      month === this.store.month() ? undefined : `Saved to ${monthLabel(month, this.locale)}.`,
    );
  }
}
