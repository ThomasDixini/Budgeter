import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
} from '@angular/core';
import { DistributionSlice } from '../../../../core/finances/investments-analytics';
import { investmentKindLabel } from '../../../../core/finances/investments';
import { formatMoney } from '../../../../core/finances/money';

interface SliceView {
  readonly kind: string;
  readonly label: string;
  readonly percent: number;
  readonly percentText: string;
  readonly valueText: string;
}

/**
 * How the portfolio splits between kinds of investment: one proportional bar and a legend.
 * @example <app-portfolio-distribution [slices]="slices()" />
 */
@Component({
  selector: 'app-portfolio-distribution',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './portfolio-distribution.html',
  styleUrl: './portfolio-distribution.css',
})
export class PortfolioDistribution {
  private readonly locale = inject(LOCALE_ID);

  readonly slices = input.required<readonly DistributionSlice[]>();

  protected readonly views = computed<SliceView[]>(() =>
    this.slices().map((slice) => ({
      kind: slice.kind,
      label: investmentKindLabel(slice.kind),
      percent: slice.percent,
      percentText: `${Math.round(slice.percent)}%`,
      valueText: formatMoney(slice.valueCents, this.locale),
    })),
  );
}
