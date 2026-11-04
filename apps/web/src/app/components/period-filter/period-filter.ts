import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { fieldValue } from '../../core/forms/field-value';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  PERIOD_OPTIONS,
  Period,
  PeriodMonths,
  isValidCustomPeriod,
  periodRange,
} from '../../core/finances/period';

/**
 * Chooses the stretch of time a page covers: the last 3, 6 or 12 months, or a "Custom" period with a start
 * and an end day. Typed days that do not make a period are explained and the last good one is kept.
 * @example <app-period-filter [period]="period()" [today]="today" (periodChange)="period.set($event)" />
 */
@Component({
  selector: 'app-period-filter',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './period-filter.html',
  styleUrl: './period-filter.css',
})
export class PeriodFilter {
  readonly period = input.required<Period>();
  /** Today, `YYYY-MM-DD`: where a preset period ends. */
  readonly today = input.required<string>();
  /** Writes the presets as `3M` instead of `3 months`, for a tight spot. */
  readonly shortLabels = input(false);
  readonly periodChange = output<Period>();

  protected readonly options = PERIOD_OPTIONS;
  /** Why the typed days are not a period, until they are fixed. */
  protected readonly error = signal<string | undefined>(undefined);
  protected readonly isCustom = computed(() => this.period().kind === 'custom');
  protected readonly range = computed(() => periodRange(this.period(), this.today()));
  protected readonly presetMonths = computed(() => {
    const period = this.period();
    return period.kind === 'months' ? period.months : undefined;
  });

  protected valueOf(event: Event): string {
    return fieldValue(event);
  }

  protected pickPreset(months: PeriodMonths): void {
    this.error.set(undefined);
    this.periodChange.emit({ kind: 'months', months });
  }

  /** Switches to a period of days, starting from the days the preset covered. */
  protected pickCustom(): void {
    if (this.isCustom()) return;
    this.periodChange.emit({ kind: 'custom', ...this.range() });
  }

  protected changeRange(side: 'from' | 'to', value: string): void {
    const next = { ...this.range(), [side]: value };
    if (!isValidCustomPeriod(next.from, next.to)) {
      this.error.set('Pick a start day that is not after the end, within 10 years.');
      return;
    }
    this.error.set(undefined);
    this.periodChange.emit({ kind: 'custom', from: next.from, to: next.to });
  }
}
