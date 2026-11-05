import { Component, LOCALE_ID, computed, inject, input, output, signal } from '@angular/core';
import {
  IncomeSplit,
  SPLIT_COLORS,
  SplitPreset,
  SplitStatus,
  partCents,
  totalPercent,
} from '../../../../core/finances/income-split';
import { formatMoney } from '../../../../core/finances/money';

/** Parts narrower than this show no percentage inside their segment. */
const MIN_LABELLED_PERCENT = 8;

/** One colored segment of the distribution bar. */
interface BarSegment {
  readonly id: string;
  readonly name: string;
  readonly percent: number;
  readonly color: string;
  readonly inside: string;
  readonly detail: string;
}

/**
 * How the income is shared as one bar of colored segments, with whether it adds up to 100% and ready
 * made splits to start from.
 */
@Component({
  selector: 'app-split-overview',
  templateUrl: './split-overview.html',
  styleUrl: './split-overview.css',
})
export class SplitOverview {
  readonly split = input.required<IncomeSplit>();
  readonly status = input.required<SplitStatus>();
  readonly presets = input.required<readonly SplitPreset[]>();
  readonly applyPreset = output<SplitPreset>();

  private readonly locale = inject(LOCALE_ID);
  protected readonly hoveredId = signal<string | undefined>(undefined);

  protected readonly segments = computed<BarSegment[]>(() =>
    this.split()
      .parts.filter((part) => part.percent > 0)
      .map((part) => ({
        id: part.id,
        name: part.name,
        percent: part.percent,
        color: SPLIT_COLORS[part.color].hex,
        inside: part.percent >= MIN_LABELLED_PERCENT ? `${part.percent}%` : '',
        detail: `${part.percent}% · ${formatMoney(partCents(this.split().baseIncomeCents, part.percent), this.locale)}`,
      })),
  );
  protected readonly freePercent = computed(() => {
    const status = this.status();
    return status.kind === 'short' ? status.percent : 0;
  });
  protected readonly statusText = computed(() => this.describe(this.status()));
  protected readonly barLabel = computed(() => {
    const parts = this.split().parts.map((part) => `${part.name} ${part.percent}%`);
    return `Income split: ${parts.join(', ')}. Total ${totalPercent(this.split().parts)}%.`;
  });

  private describe(status: SplitStatus): string {
    if (status.kind === 'balanced') return '100% assigned';
    if (status.kind === 'over') return `${status.percent}% over the total`;
    const cents = formatMoney(status.cents, this.locale);
    return this.split().baseIncomeCents > 0
      ? `${status.percent}% left · ${cents} with no destination`
      : `${status.percent}% left with no destination`;
  }
}
