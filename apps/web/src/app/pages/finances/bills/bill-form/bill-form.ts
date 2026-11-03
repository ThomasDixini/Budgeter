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
  Bill,
  BillDraft,
  BillKind,
  BillRecurrence,
  DEFAULT_REPEAT_COUNTS,
  MAX_DESCRIPTION_LENGTH,
  MAX_REPEAT_COUNT,
  MIN_REPEAT_COUNT,
  REPEAT_OPTIONS,
  isValidRepeatCount,
  seriesLabel,
} from '../../../../core/finances/bills';
import { FinanceCategory } from '../../../../core/finances/finance-references';
import { amountText, isValidAmount, parseAmountCents } from '../../../../core/finances/money';
import { fieldValue } from '../../../../core/forms/field-value';

/** Choices of the pay/receive switch. */
const KIND_OPTIONS: readonly { value: BillKind; label: string }[] = [
  { value: 'payable', label: 'To pay' },
  { value: 'receivable', label: 'To receive' },
];

/**
 * Inline form to add a bill or edit an open one: what it is, how much, its category and due date, and
 * (for a new bill) whether it repeats. Editing changes that occurrence only.
 */
@Component({
  selector: 'app-bill-form',
  templateUrl: './bill-form.html',
  styleUrl: './bill-form.css',
})
export class BillForm {
  /** The bill being edited; absent when adding one. */
  readonly bill = input<Bill>();
  readonly categories = input.required<readonly FinanceCategory[]>();
  /** The due date a new bill starts on, `YYYY-MM-DD`. */
  readonly today = input.required<string>();
  readonly save = output<BillDraft>();
  readonly dismiss = output();
  readonly remove = output();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterNextRender(() =>
      this.host.nativeElement.querySelector<HTMLInputElement>('input[name="description"]')?.focus(),
    );
  }

  protected readonly kindOptions = KIND_OPTIONS;
  protected readonly repeatOptions = REPEAT_OPTIONS;
  protected readonly maxDescriptionLength = MAX_DESCRIPTION_LENGTH;
  protected readonly minCount = MIN_REPEAT_COUNT;
  protected readonly maxCount = MAX_REPEAT_COUNT;
  protected readonly isEditing = computed(() => this.bill() !== undefined);
  protected readonly seriesNote = computed(() => seriesLabel(this.bill()?.series));

  protected readonly kind = linkedSignal<BillKind>(() => this.bill()?.kind ?? 'payable');
  protected readonly description = linkedSignal(() => this.bill()?.description ?? '');
  protected readonly amount = linkedSignal(() => {
    const bill = this.bill();
    return bill === undefined ? '' : amountText(bill.amountCents);
  });
  protected readonly categoryId = linkedSignal(() => this.bill()?.categoryId ?? '');
  protected readonly dueDate = linkedSignal(() => this.bill()?.dueDate ?? this.today());
  protected readonly repeatKind = signal<BillRecurrence | 'none'>('none');
  protected readonly repeatCount = signal(String(DEFAULT_REPEAT_COUNTS.monthly));

  private readonly amountCents = computed(() => parseAmountCents(this.amount()));
  protected readonly isRepeating = computed(
    () => !this.isEditing() && this.repeatKind() !== 'none',
  );
  protected readonly amountError = computed(() =>
    this.amount().trim() !== '' && !isValidAmount(this.amountCents())
      ? 'Enter an amount above zero, like 1500.00.'
      : undefined,
  );
  protected readonly countError = computed(() =>
    this.isRepeating() && !isValidRepeatCount(Number(this.repeatCount()))
      ? `Enter a whole number from ${MIN_REPEAT_COUNT} to ${MAX_REPEAT_COUNT}.`
      : undefined,
  );
  protected readonly canSave = computed(
    () =>
      this.description().trim() !== '' &&
      isValidAmount(this.amountCents()) &&
      this.categoryId() !== '' &&
      this.dueDate() !== '' &&
      this.countError() === undefined,
  );

  protected chooseRepeat(value: string): void {
    const repeat = value as BillRecurrence | 'none';
    this.repeatKind.set(repeat);
    if (repeat !== 'none') this.repeatCount.set(String(DEFAULT_REPEAT_COUNTS[repeat]));
  }

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    const cents = this.amountCents();
    if (!this.canSave() || !isValidAmount(cents)) return;
    this.save.emit({
      kind: this.kind(),
      description: this.description().trim(),
      categoryId: this.categoryId(),
      amountCents: cents,
      dueDate: this.dueDate(),
      repeat: this.repeatDraft(),
    });
  }

  private repeatDraft(): BillDraft['repeat'] {
    const kind = this.repeatKind();
    if (!this.isRepeating() || kind === 'none') return undefined;
    return { kind, count: Number(this.repeatCount()) };
  }

  protected readonly valueOf = fieldValue;
}
