import { formatDate } from '@angular/common';
import { Component, LOCALE_ID, computed, inject } from '@angular/core';
import { LoadFailed } from '../../../components/load-failed/load-failed';
import { PageHeading } from '../../../components/page-heading/page-heading';
import { parseIsoDate } from '../../../core/calendar/date-label';
import { IncomeSplitStore } from '../../../core/finances/income-split-store';
import { monthLabel } from '../../../core/finances/transaction-month';
import { CategoryManager } from './category-manager/category-manager';
import { IncomeBase } from './income-base/income-base';
import { PlanVsActual } from './plan-vs-actual/plan-vs-actual';
import { SplitOverview } from './split-overview/split-overview';
import { SplitParts } from './split-parts/split-parts';

const PREVIOUS_MONTH_NAME_FORMAT = 'MMMM';

/**
 * Income split: how the monthly income is shared between parts (needs, investments…), which categories
 * each part spends on, and how this month's spending compares with the plan. Edits stay on the page
 * until "Save split"; categories are managed at the bottom.
 */
@Component({
  selector: 'app-finances-income-split',
  imports: [
    PageHeading,
    LoadFailed,
    IncomeBase,
    SplitOverview,
    SplitParts,
    PlanVsActual,
    CategoryManager,
  ],
  providers: [IncomeSplitStore],
  templateUrl: './income-split.html',
  styleUrl: './income-split.css',
})
export class IncomeSplitPage {
  protected readonly store = inject(IncomeSplitStore);
  private readonly locale = inject(LOCALE_ID);

  protected readonly monthTitle = computed(() => monthLabel(this.store.month, this.locale));
  protected readonly previousMonthName = computed(() =>
    formatDate(
      parseIsoDate(`${this.store.previousMonth}-01`),
      PREVIOUS_MONTH_NAME_FORMAT,
      this.locale,
    ),
  );
  protected readonly saveLabel = computed(() => (this.store.isSaving() ? 'Saving…' : 'Save split'));
}
