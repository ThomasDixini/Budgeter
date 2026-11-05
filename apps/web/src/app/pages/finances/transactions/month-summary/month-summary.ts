import { Component, LOCALE_ID, computed, inject, input } from '@angular/core';
import { formatMoney, formatSignedMoney } from '../../../../core/finances/money';
import { TransactionSummary } from '../../../../core/finances/transaction-summary';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

/** Shown in every card while the month is still loading, instead of totals that are not real yet. */
const PENDING_VALUE = '—';

/** The four totals above the transactions list: income, expenses, net result and count. */
@Component({
  selector: 'app-month-summary',
  imports: [TranslatePipe],
  templateUrl: './month-summary.html',
  styleUrl: './month-summary.css',
})
export class MonthSummary {
  readonly summary = input.required<TransactionSummary>();
  readonly isLoading = input(false);

  private readonly locale = inject(LOCALE_ID);

  protected readonly income = computed(() =>
    this.pendingOr(() => formatMoney(this.summary().incomeCents, this.locale)),
  );
  protected readonly expenses = computed(() =>
    this.pendingOr(() => formatMoney(this.summary().expenseCents, this.locale)),
  );
  protected readonly net = computed(() =>
    this.pendingOr(() => formatSignedMoney(this.summary().netCents, this.locale)),
  );
  protected readonly count = computed(() => this.pendingOr(() => String(this.summary().count)));

  private pendingOr(value: () => string): string {
    return this.isLoading() ? PENDING_VALUE : value();
  }
}
