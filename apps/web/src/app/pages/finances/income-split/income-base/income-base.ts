import { Component, LOCALE_ID, computed, inject, input, linkedSignal, output } from '@angular/core';
import { fieldValue } from '../../../../core/forms/field-value';
import {
  amountText,
  formatMoney,
  isValidAmount,
  parseAmountCents,
} from '../../../../core/finances/money';

/**
 * The monthly income the split is based on: typed in, or taken from what came in last month (all of
 * it, or the salary alone). A blank field means no income yet.
 */
@Component({
  selector: 'app-income-base',
  templateUrl: './income-base.html',
  styleUrl: './income-base.css',
})
export class IncomeBase {
  /** The base income of the split on screen, in cents. */
  readonly baseIncomeCents = input.required<number>();
  /** Everything that came in last month, in cents. */
  readonly lastMonthCents = input.required<number>();
  /** The salary that came in last month, in cents; 0 hides its shortcut. */
  readonly salaryCents = input(0);
  /** The month the shortcuts read, spelled out (e.g. "September"). */
  readonly previousMonthName = input.required<string>();
  readonly baseIncomeChange = output<number>();

  private readonly locale = inject(LOCALE_ID);

  // Linked to the split so the field refills when a shortcut sets the income from outside.
  protected readonly text = linkedSignal(() =>
    this.baseIncomeCents() === 0 ? '' : amountText(this.baseIncomeCents()),
  );
  protected readonly error = computed(() =>
    this.text().trim() !== '' && !isValidAmount(parseAmountCents(this.text()))
      ? 'Enter an income above zero, like 9500.00.'
      : undefined,
  );

  protected lastMonthLabel(): string {
    return `Use ${this.previousMonthName()} income · ${formatMoney(this.lastMonthCents(), this.locale)}`;
  }

  protected salaryLabel(): string {
    return `Salary only · ${formatMoney(this.salaryCents(), this.locale)}`;
  }

  protected type(event: Event): void {
    const text = fieldValue(event);
    this.text.set(text);
    if (text.trim() === '') this.baseIncomeChange.emit(0);
    else this.emitIfValid(parseAmountCents(text));
  }

  protected use(cents: number): void {
    this.baseIncomeChange.emit(cents);
  }

  private emitIfValid(cents: number | undefined): void {
    if (isValidAmount(cents)) this.baseIncomeChange.emit(cents);
  }
}
