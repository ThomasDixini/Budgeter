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
import {
  INVESTMENT_KIND_OPTIONS,
  Investment,
  InvestmentDraft,
  InvestmentKind,
} from '../../../../core/finances/investments';
import { amountText, isValidAmount, parseAmountCents } from '../../../../core/finances/money';
import { fieldValue } from '../../../../core/forms/field-value';

const MAX_NAME_LENGTH = 40;

/**
 * Inline form to add an investment or edit one: its name, kind and the latest price of one unit. The
 * price is dated today when it is typed or changed; leaving it blank values the investment at cost.
 */
@Component({
  selector: 'app-investment-form',
  templateUrl: './investment-form.html',
  styleUrl: './investment-form.css',
})
export class InvestmentForm {
  /** The investment being edited; absent when adding one. */
  readonly investment = input<Investment>();
  /** The day a typed price is from, `YYYY-MM-DD`. */
  readonly today = input.required<string>();
  readonly saving = input(false);
  readonly save = output<InvestmentDraft>();
  readonly dismiss = output();
  readonly remove = output();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterNextRender(() =>
      this.host.nativeElement.querySelector<HTMLInputElement>('input[name="name"]')?.focus(),
    );
  }

  protected readonly kindOptions = INVESTMENT_KIND_OPTIONS;
  protected readonly maxNameLength = MAX_NAME_LENGTH;
  protected readonly isEditing = computed(() => this.investment() !== undefined);
  protected readonly name = linkedSignal(() => this.investment()?.name ?? '');
  protected readonly kind = linkedSignal<InvestmentKind>(() => this.investment()?.kind ?? 'stock');
  protected readonly price = linkedSignal(() => {
    const price = this.investment()?.price;
    return price === undefined ? '' : amountText(price.cents);
  });

  private readonly priceCents = computed(() => parseAmountCents(this.price()));
  protected readonly priceError = computed(() =>
    this.price().trim() !== '' && !isValidAmount(this.priceCents())
      ? 'Enter a price above zero, like 38.45, or leave it blank.'
      : undefined,
  );
  protected readonly canSave = computed(
    () => this.name().trim() !== '' && this.priceError() === undefined && !this.saving(),
  );

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    if (!this.canSave()) return;
    this.save.emit({
      name: this.name().trim(),
      kind: this.kind(),
      price: this.pricePoint(),
    });
  }

  // An unchanged price keeps the day it was typed on.
  private pricePoint(): InvestmentDraft['price'] {
    const cents = this.priceCents();
    if (!isValidAmount(cents)) return undefined;
    const stored = this.investment()?.price;
    return { cents, on: stored?.cents === cents ? stored.on : this.today() };
  }

  protected readonly valueOf = fieldValue;
}
