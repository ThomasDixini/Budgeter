import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import {
  INCOME_KIND_OPTIONS,
  IncomeDraft,
  IncomeKind,
} from '../../../../core/finances/investments';
import { isValidAmount, parseAmountCents } from '../../../../core/finances/money';
import { fieldValue } from '../../../../core/forms/field-value';

/** What the income form fills in; the page adds the investment. */
export type IncomeFields = Omit<IncomeDraft, 'investmentId'>;

/** Inline form to record a provento an investment paid: which kind, how much and on which day. */
@Component({
  selector: 'app-income-form',
  templateUrl: './income-form.html',
  styleUrl: './income-form.css',
})
export class IncomeForm {
  readonly investmentName = input.required<string>();
  readonly today = input.required<string>();
  readonly saving = input(false);
  readonly save = output<IncomeFields>();
  readonly dismiss = output();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterNextRender(() =>
      this.host.nativeElement.querySelector<HTMLInputElement>('input[name="amount"]')?.focus(),
    );
  }

  protected readonly kindOptions = INCOME_KIND_OPTIONS;
  protected readonly kind = signal<IncomeKind>('dividend');
  protected readonly amount = signal('');
  protected readonly date = linkedSignal(() => this.today());

  private readonly amountCents = computed(() => parseAmountCents(this.amount()));
  protected readonly amountError = computed(() =>
    this.amount().trim() !== '' && !isValidAmount(this.amountCents())
      ? 'Enter an amount above zero, like 15.00.'
      : undefined,
  );
  protected readonly canSave = computed(
    () => isValidAmount(this.amountCents()) && this.date() !== '' && !this.saving(),
  );

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    const cents = this.amountCents();
    if (!this.canSave() || !isValidAmount(cents)) return;
    this.save.emit({ date: this.date(), kind: this.kind(), amountCents: cents });
  }

  protected readonly valueOf = fieldValue;
}
