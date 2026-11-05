import {
  Component,
  ElementRef,
  LOCALE_ID,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import {
  TradeDraft,
  TradeKind,
  isValidQuantity,
  parseQuantityThousandths,
  tradeTotalCents,
} from '../../../../core/finances/investments';
import {
  amountText,
  formatMoney,
  isValidAmount,
  parseAmountCents,
} from '../../../../core/finances/money';
import { fieldValue } from '../../../../core/forms/field-value';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

/** What the trade form fills in; the page adds the investment. */
export type TradeFields = Omit<TradeDraft, 'investmentId'>;

const KIND_OPTIONS: readonly { value: TradeKind; label: string }[] = [
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' },
];

/**
 * Inline form to record a purchase or a sale of an investment: how many units, at what price and on
 * which day. It shows what the trade comes to as it is typed.
 */
@Component({
  selector: 'app-trade-form',
  imports: [TranslatePipe],
  templateUrl: './trade-form.html',
  styleUrl: './trade-form.css',
})
export class TradeForm {
  readonly investmentName = input.required<string>();
  /** The price the unit starts at (the latest known); 0 leaves it blank. */
  readonly suggestedPriceCents = input(0);
  readonly today = input.required<string>();
  readonly saving = input(false);
  readonly save = output<TradeFields>();
  readonly dismiss = output();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly locale = inject(LOCALE_ID);

  constructor() {
    afterNextRender(() =>
      this.host.nativeElement.querySelector<HTMLInputElement>('input[name="quantity"]')?.focus(),
    );
  }

  protected readonly kindOptions = KIND_OPTIONS;
  protected readonly kind = signal<TradeKind>('buy');
  protected readonly quantity = signal('');
  protected readonly price = linkedSignal(() =>
    this.suggestedPriceCents() > 0 ? amountText(this.suggestedPriceCents()) : '',
  );
  protected readonly date = linkedSignal(() => this.today());

  private readonly quantityThousandths = computed(() => parseQuantityThousandths(this.quantity()));
  private readonly priceCents = computed(() => parseAmountCents(this.price()));
  protected readonly quantityError = computed(() =>
    this.quantity().trim() !== '' && !isValidQuantity(this.quantityThousandths())
      ? 'Enter a quantity above zero, like 100 or 2.5.'
      : undefined,
  );
  protected readonly priceError = computed(() =>
    this.price().trim() !== '' && !isValidAmount(this.priceCents())
      ? 'Enter a price above zero, like 38.45.'
      : undefined,
  );
  protected readonly total = computed(() => {
    const quantity = this.quantityThousandths();
    const price = this.priceCents();
    if (!isValidQuantity(quantity) || !isValidAmount(price)) return undefined;
    return formatMoney(tradeTotalCents(quantity, price), this.locale);
  });
  protected readonly canSave = computed(
    () => this.total() !== undefined && this.date() !== '' && !this.saving(),
  );

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    const quantity = this.quantityThousandths();
    const price = this.priceCents();
    if (!this.canSave() || !isValidQuantity(quantity) || !isValidAmount(price)) return;
    this.save.emit({
      date: this.date(),
      kind: this.kind(),
      quantityThousandths: quantity,
      unitPriceCents: price,
    });
  }

  protected readonly valueOf = fieldValue;
}
