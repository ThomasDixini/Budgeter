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
import { Account, FinanceCategory } from '../../../../core/finances/finance-references';
import { amountText, isValidAmount, parseAmountCents } from '../../../../core/finances/money';
import {
  TRANSACTION_TYPE_OPTIONS,
  Transaction,
  TransactionDraft,
  TransactionType,
  signedCents,
  typeOf,
} from '../../../../core/finances/transaction';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

/**
 * Inline form above the transactions list: expense or income, amount, description, category,
 * account and day. Records a new transaction, or edits (and deletes) the one given in `transaction`.
 */
@Component({
  selector: 'app-transaction-form',
  imports: [TranslatePipe],
  templateUrl: './transaction-form.html',
  styleUrl: './transaction-form.css',
})
export class TransactionForm {
  readonly categories = input.required<readonly FinanceCategory[]>();
  readonly accounts = input.required<readonly Account[]>();
  /** The day a new transaction starts on. */
  readonly defaultDate = input.required<string>();
  /** The account a new transaction starts on, usually the last one used. */
  readonly defaultAccountId = input<string>();
  /** The transaction being edited; leave unset to record a new one. */
  readonly transaction = input<Transaction | undefined>(undefined);
  readonly save = output<TransactionDraft>();
  readonly dismiss = output();
  readonly remove = output();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // The form opens at the top of the page, which can be far from the row that opened it: put the
    // cursor in the amount, the field typed first, so the user lands on it.
    afterNextRender(() =>
      this.host.nativeElement.querySelector<HTMLInputElement>('input[name="amount"]')?.focus(),
    );
  }

  protected readonly typeOptions = TRANSACTION_TYPE_OPTIONS;
  protected readonly isEditing = computed(() => this.transaction() !== undefined);
  // Linked to the transaction so the fields refill when the form is pointed at another one.
  protected readonly type = linkedSignal<TransactionType>(() => {
    const transaction = this.transaction();
    return transaction === undefined ? 'expense' : typeOf(transaction);
  });
  protected readonly amount = linkedSignal(() => {
    const transaction = this.transaction();
    return transaction === undefined ? '' : amountText(transaction.amountCents);
  });
  protected readonly description = linkedSignal(() => this.transaction()?.description ?? '');
  protected readonly categoryId = linkedSignal(() => this.transaction()?.categoryId ?? '');
  protected readonly accountId = linkedSignal(
    () => this.transaction()?.accountId ?? this.defaultAccountId() ?? '',
  );
  protected readonly date = linkedSignal(() => this.transaction()?.date ?? this.defaultDate());

  private readonly amountCents = computed(() => parseAmountCents(this.amount()));
  /** Said only once something was typed, so an empty new form does not open on an error. */
  protected readonly amountError = computed(() =>
    this.amount().trim() !== '' && !isValidAmount(this.amountCents())
      ? 'Enter an amount above zero, like 286.40.'
      : undefined,
  );
  protected readonly canSave = computed(
    () =>
      isValidAmount(this.amountCents()) &&
      this.description().trim() !== '' &&
      this.categoryId() !== '' &&
      this.accountId() !== '' &&
      this.date() !== '',
  );

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    const cents = this.amountCents();
    if (!this.canSave() || !isValidAmount(cents)) return;
    this.save.emit({
      date: this.date(),
      description: this.description().trim(),
      categoryId: this.categoryId(),
      accountId: this.accountId(),
      amountCents: signedCents(cents, this.type()),
    });
  }

  protected readonly valueOf = fieldValue;
}
