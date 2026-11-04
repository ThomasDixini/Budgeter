import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { fieldValue } from '../../../../core/forms/field-value';
import { CardPaymentDraft } from '../../../../core/finances/account-statement';
import { Account } from '../../../../core/finances/finance-references';
import { amountText, isValidAmount, parseAmountCents } from '../../../../core/finances/money';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

/**
 * Inline form to pay a credit card's invoice from a bank account: which account, how much (the
 * suggested amount to start with) and on which day.
 */
@Component({
  selector: 'app-payment-form',
  imports: [TranslatePipe],
  templateUrl: './payment-form.html',
  styleUrl: './payment-form.css',
})
export class PaymentForm {
  readonly card = input.required<Account>();
  /** The accounts a payment can come from, in display order. */
  readonly bankAccounts = input.required<readonly Account[]>();
  /** What the amount starts at; 0 leaves it blank. */
  readonly suggestedCents = input(0);
  /** The day the payment starts on, `YYYY-MM-DD`. */
  readonly today = input.required<string>();
  readonly save = output<CardPaymentDraft>();
  readonly dismiss = output();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterNextRender(() =>
      this.host.nativeElement.querySelector<HTMLInputElement>('input[name="amount"]')?.focus(),
    );
  }

  protected readonly fromAccountId = linkedSignal(() => this.bankAccounts()[0]?.id ?? '');
  protected readonly amount = linkedSignal(() =>
    this.suggestedCents() > 0 ? amountText(this.suggestedCents()) : '',
  );
  protected readonly date = linkedSignal(() => this.today());

  private readonly amountCents = computed(() => parseAmountCents(this.amount()));
  protected readonly amountError = computed(() =>
    this.amount().trim() !== '' && !isValidAmount(this.amountCents())
      ? 'Enter an amount above zero, like 286.40.'
      : undefined,
  );
  protected readonly canSave = computed(
    () => isValidAmount(this.amountCents()) && this.fromAccountId() !== '' && this.date() !== '',
  );

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    const cents = this.amountCents();
    if (!this.canSave() || !isValidAmount(cents)) return;
    this.save.emit({
      cardId: this.card().id,
      fromAccountId: this.fromAccountId(),
      date: this.date(),
      amountCents: cents,
    });
  }

  protected readonly valueOf = fieldValue;
}
