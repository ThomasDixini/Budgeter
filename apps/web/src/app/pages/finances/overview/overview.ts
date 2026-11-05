import { formatDate } from '@angular/common';
import { Component, LOCALE_ID, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LoadFailed } from '../../../components/load-failed/load-failed';
import { PageHeading } from '../../../components/page-heading/page-heading';
import { parseIsoDate, shortDateLabel } from '../../../core/calendar/date-label';
import { AgendaItem, dueLabel } from '../../../core/finances/bills';
import { MonthFlow } from '../../../core/finances/overview';
import { OverviewStore } from '../../../core/finances/overview-store';
import { formatBalance, formatMoney, formatSignedMoney } from '../../../core/finances/money';
import { Transaction } from '../../../core/finances/transaction';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

/** One month of the chart with the bar heights worked out. */
interface FlowColumn {
  readonly label: string;
  readonly description: string;
  readonly incomeHeight: number;
  readonly expenseHeight: number;
}

/**
 * Finances overview: where the money stands (balances, open invoices, this month), received against
 * spent over six months, spending by category, the latest transactions and what is due next.
 */
@Component({
  selector: 'app-finances-overview',
  imports: [TranslatePipe, PageHeading, LoadFailed, RouterLink],
  providers: [OverviewStore],
  templateUrl: './overview.html',
  styleUrl: './overview.css',
})
export class Overview {
  private readonly store = inject(OverviewStore);
  private readonly locale = inject(LOCALE_ID);

  protected readonly today = this.store.today;
  protected readonly isLoaded = this.store.isLoaded;
  protected readonly hasLoadFailed = this.store.hasLoadFailed;
  protected readonly spending = this.store.spending;
  protected readonly latest = this.store.latest;
  protected readonly dues = this.store.dues;
  protected readonly categoryNames = this.store.categoryNames;
  protected readonly accountNames = this.store.accountNames;
  protected readonly columns = computed(() => this.store.flow().map((month) => this.column(month)));
  protected readonly inAccounts = computed(() =>
    this.show(formatBalance(this.store.totals().bankBalanceCents, this.locale)),
  );
  protected readonly openInvoices = computed(() =>
    this.show(formatMoney(this.store.totals().cardOwedCents, this.locale)),
  );
  protected readonly received = computed(() =>
    this.show(formatMoney(this.store.thisMonth().incomeCents, this.locale)),
  );
  protected readonly spent = computed(() =>
    this.show(formatMoney(this.store.thisMonth().expenseCents, this.locale)),
  );
  protected readonly monthName = formatDate(
    parseIsoDate(`${this.store.month}-01`),
    'MMMM',
    this.locale,
  );

  protected money(cents: number): string {
    return formatMoney(cents, this.locale);
  }

  protected signed(cents: number): string {
    return formatSignedMoney(cents, this.locale);
  }

  protected day(isoDay: string): string {
    return shortDateLabel(isoDay, this.locale);
  }

  protected dueText(item: AgendaItem): string {
    return `${dueLabel(item.dueDate, this.today)} (${this.day(item.dueDate)})`;
  }

  protected dueAmount(item: AgendaItem): string {
    return formatSignedMoney(
      item.kind === 'payable' ? -item.amountCents : item.amountCents,
      this.locale,
    );
  }

  protected transactionDetail(transaction: Transaction): string {
    const category = this.categoryNames().get(transaction.categoryId);
    const account = this.accountNames().get(transaction.accountId);
    return [this.day(transaction.date), category, account].filter(Boolean).join(' · ');
  }

  protected reload(): void {
    this.store.reload();
  }

  // Figures stay blank until everything has arrived, so a partial sum is never read as the total.
  private show(text: string): string {
    return this.isLoaded() ? text : '—';
  }

  private column(month: MonthFlow): FlowColumn {
    const peak = this.store.flowPeak();
    const label = formatDate(parseIsoDate(`${month.month}-01`), 'MMM', this.locale);
    return {
      label,
      description: `${label}: received ${this.money(month.incomeCents)}, spent ${this.money(month.expenseCents)}`,
      incomeHeight: (month.incomeCents / peak) * 100,
      expenseHeight: (month.expenseCents / peak) * 100,
    };
  }
}
