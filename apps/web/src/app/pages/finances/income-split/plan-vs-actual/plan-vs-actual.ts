import { Component, LOCALE_ID, computed, inject, input } from '@angular/core';
import { PartProgress, SPLIT_COLORS } from '../../../../core/finances/income-split';
import { formatMoney } from '../../../../core/finances/money';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

const WHOLE = 100;

/** One bar of the comparison. */
interface ProgressRow {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly status: string;
  readonly isOver: boolean;
  readonly fill: number;
  readonly spent: string;
  readonly planned: string;
}

/** Each part's month so far: what the expenses of its categories used of what was planned. */
@Component({
  selector: 'app-plan-vs-actual',
  imports: [TranslatePipe],
  templateUrl: './plan-vs-actual.html',
  styleUrl: './plan-vs-actual.css',
})
export class PlanVsActual {
  readonly progress = input.required<readonly PartProgress[]>();
  /** The month spelled out, with its year (e.g. "November 2026"). */
  readonly monthTitle = input.required<string>();

  private readonly locale = inject(LOCALE_ID);

  protected readonly rows = computed<ProgressRow[]>(() =>
    this.progress().map((item) => ({
      id: item.part.id,
      name: item.part.name,
      color: SPLIT_COLORS[item.part.color].hex,
      status:
        item.overCents > 0 ? `Over by ${this.money(item.overCents)}` : `${item.usedPercent}% used`,
      isOver: item.overCents > 0,
      fill: Math.min(WHOLE, item.usedPercent),
      spent: this.money(item.spentCents),
      planned: this.money(item.plannedCents),
    })),
  );

  private money(cents: number): string {
    return formatMoney(cents, this.locale);
  }
}
