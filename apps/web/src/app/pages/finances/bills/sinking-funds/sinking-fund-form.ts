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
import { MAX_DESCRIPTION_LENGTH } from '../../../../core/finances/bills';
import { FinanceCategory } from '../../../../core/finances/finance-references';
import { amountText, isValidAmount, parseAmountCents } from '../../../../core/finances/money';
import {
  SinkingFund,
  SinkingFundDraft,
  SinkingFundScheduleDraft,
  SinkingFundScheduleKind,
} from '../../../../core/finances/sinking-funds';
import { fieldValue } from '../../../../core/forms/field-value';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

const MIN_INTERVAL_MONTHS = 1;
const MAX_INTERVAL_MONTHS = 60;
const MIN_MONTH = 1;
const MAX_MONTH = 12;
const MIN_DAY = 1;
const MAX_DAY = 31;
const WHOLE_NUMBER_ERROR = 'Enter a whole number from {min} to {max}.';

/** Choices of the "Repeats" select. */
const KIND_OPTIONS: readonly { value: SinkingFundScheduleKind; label: string }[] = [
  { value: 'everyMonths', label: 'Every few months' },
  { value: 'fixedDate', label: 'Every year on a fixed date' },
];

/** Whether typed text is a whole number within the inclusive range. */
function isWholeNumberBetween(text: string, min: number, max: number): boolean {
  const value = Number(text);
  return text.trim() !== '' && Number.isInteger(value) && value >= min && value <= max;
}

/**
 * Inline form to create or edit a sinking fund: what it is, its category, what each cycle costs and
 * when it falls due (every few months, or on a fixed date each year).
 * @example <app-sinking-fund-form [fund]="null" [categories]="categories" today="2026-05-10" />
 */
@Component({
  selector: 'app-sinking-fund-form',
  imports: [TranslatePipe],
  templateUrl: './sinking-fund-form.html',
  styleUrl: './sinking-fund-form.css',
})
export class SinkingFundForm {
  /** The fund being edited; `null` when creating one. */
  readonly fund = input<SinkingFund | null>(null);
  readonly categories = input.required<readonly FinanceCategory[]>();
  /** Today, `YYYY-MM-DD`: the earliest next due date. */
  readonly today = input.required<string>();
  /** `id` is the edited fund's id, `null` for a new fund. */
  readonly saved = output<{ id: string | null; draft: SinkingFundDraft }>();
  readonly cancelled = output();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterNextRender(() =>
      this.host.nativeElement.querySelector<HTMLInputElement>('input[name="description"]')?.focus(),
    );
  }

  protected readonly kindOptions = KIND_OPTIONS;
  protected readonly maxDescriptionLength = MAX_DESCRIPTION_LENGTH;
  protected readonly minInterval = MIN_INTERVAL_MONTHS;
  protected readonly maxInterval = MAX_INTERVAL_MONTHS;
  protected readonly minMonth = MIN_MONTH;
  protected readonly maxMonth = MAX_MONTH;
  protected readonly minDay = MIN_DAY;
  protected readonly maxDay = MAX_DAY;
  protected readonly isEditing = computed(() => this.fund() !== null);

  protected readonly description = linkedSignal(() => this.fund()?.description ?? '');
  protected readonly categoryId = linkedSignal(() => this.fund()?.categoryId ?? '');
  protected readonly amount = linkedSignal(() => {
    const fund = this.fund();
    return fund === null ? '' : amountText(fund.amountCents);
  });
  protected readonly kind = linkedSignal<SinkingFundScheduleKind>(
    () => this.fund()?.schedule.kind ?? 'everyMonths',
  );
  protected readonly intervalMonths = linkedSignal(() => this.intervalPrefill());
  protected readonly nextDueDate = linkedSignal(
    () => this.fund()?.schedule.nextDueDate ?? this.today(),
  );
  protected readonly month = linkedSignal(() => this.fixedDatePrefill(this.fund()?.schedule.month));
  protected readonly day = linkedSignal(() => this.fixedDatePrefill(this.fund()?.schedule.day));

  private readonly amountCents = computed(() => parseAmountCents(this.amount()));
  protected readonly isEveryMonths = computed(() => this.kind() === 'everyMonths');
  protected readonly amountError = computed(() =>
    this.amount().trim() !== '' && !isValidAmount(this.amountCents())
      ? 'Enter an amount above zero, like 1500.00.'
      : undefined,
  );
  protected readonly intervalError = computed(() =>
    this.isEveryMonths() && this.intervalMonths().trim() !== '' && !this.isIntervalValid()
      ? WHOLE_NUMBER_ERROR
      : undefined,
  );
  protected readonly dueDateError = computed(() =>
    this.isEveryMonths() && this.nextDueDate() !== '' && !this.isDueDateValid()
      ? 'Pick a date that is today or later.'
      : undefined,
  );
  protected readonly monthError = computed(() =>
    !this.isEveryMonths() && this.month().trim() !== '' && !this.isMonthValid()
      ? WHOLE_NUMBER_ERROR
      : undefined,
  );
  protected readonly dayError = computed(() =>
    !this.isEveryMonths() && this.day().trim() !== '' && !this.isDayValid()
      ? WHOLE_NUMBER_ERROR
      : undefined,
  );
  protected readonly canSave = computed(
    () =>
      this.description().trim() !== '' &&
      this.categoryId() !== '' &&
      isValidAmount(this.amountCents()) &&
      this.isScheduleValid(),
  );

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    const cents = this.amountCents();
    if (!this.canSave() || !isValidAmount(cents)) return;
    this.saved.emit({
      id: this.fund()?.id ?? null,
      draft: {
        description: this.description().trim(),
        categoryId: this.categoryId(),
        amountCents: cents,
        schedule: this.scheduleDraft(),
      },
    });
  }

  private scheduleDraft(): SinkingFundScheduleDraft {
    if (this.isEveryMonths()) {
      return {
        kind: 'everyMonths',
        intervalMonths: Number(this.intervalMonths()),
        nextDueDate: this.nextDueDate(),
      };
    }
    return { kind: 'fixedDate', month: Number(this.month()), day: Number(this.day()) };
  }

  private intervalPrefill(): string {
    const schedule = this.fund()?.schedule;
    return schedule?.kind === 'everyMonths' ? String(schedule.intervalMonths) : '1';
  }

  private fixedDatePrefill(value: number | undefined): string {
    return this.fund()?.schedule.kind === 'fixedDate' && value !== undefined ? String(value) : '';
  }

  private isScheduleValid(): boolean {
    if (!this.isEveryMonths()) return this.isMonthValid() && this.isDayValid();
    return this.isIntervalValid() && this.nextDueDate() !== '' && this.isDueDateValid();
  }

  private isIntervalValid(): boolean {
    return isWholeNumberBetween(this.intervalMonths(), MIN_INTERVAL_MONTHS, MAX_INTERVAL_MONTHS);
  }

  private isDueDateValid(): boolean {
    // ISO dates compare correctly as text.
    return this.nextDueDate() >= this.today();
  }

  private isMonthValid(): boolean {
    return isWholeNumberBetween(this.month(), MIN_MONTH, MAX_MONTH);
  }

  private isDayValid(): boolean {
    return isWholeNumberBetween(this.day(), MIN_DAY, MAX_DAY);
  }

  protected chooseKind(value: string): void {
    this.kind.set(value === 'fixedDate' ? 'fixedDate' : 'everyMonths');
  }

  protected readonly valueOf = fieldValue;
}
