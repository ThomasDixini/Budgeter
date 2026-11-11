import {
  Component,
  LOCALE_ID,
  ChangeDetectionStrategy,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { shortDateLabel } from '../../../../core/calendar/date-label';
import { FinanceCategory, namesById } from '../../../../core/finances/finance-references';
import { formatMoney } from '../../../../core/finances/money';
import { SinkingFund } from '../../../../core/finances/sinking-funds';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

/**
 * The sinking funds section of the To pay & receive page: one row per fund with its progress and the
 * monthly amount to set aside. Presentational only; the page owns the data and the actions.
 *
 * @example <app-sinking-fund-list [funds]="funds()" [totalMonthlyCents]="total()" [categories]="categories()" />
 */
@Component({
  selector: 'app-sinking-fund-list',
  imports: [TranslatePipe],
  templateUrl: './sinking-fund-list.html',
  styleUrl: './sinking-fund-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SinkingFundList {
  readonly funds = input.required<readonly SinkingFund[]>();
  readonly totalMonthlyCents = input.required<number>();
  readonly categories = input.required<readonly FinanceCategory[]>();
  readonly add = output<void>();
  readonly edit = output<SinkingFund>();
  readonly remove = output<SinkingFund>();

  private readonly locale = inject(LOCALE_ID);
  private readonly categoryNames = computed(() => namesById(this.categories()));

  protected money(cents: number): string {
    return formatMoney(cents, this.locale);
  }

  protected dueDate(fund: SinkingFund): string {
    return shortDateLabel(fund.schedule.nextDueDate, this.locale);
  }

  /** Whole percent saved, capped at 100 so an over-saved fund still reads as complete. */
  protected percent(fund: SinkingFund): number {
    if (fund.amountCents <= 0) return 0;
    return Math.min(100, Math.round((fund.savedCents / fund.amountCents) * 100));
  }

  /** Empty when the category is unknown, like the bill rows do. */
  protected categoryName(fund: SinkingFund): string {
    return this.categoryNames().get(fund.categoryId) ?? '';
  }
}
