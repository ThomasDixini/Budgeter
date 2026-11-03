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
import {
  LAST_DAY_OF_MONTH,
  bankAccountDraft,
  cardTermsFrom,
  creditCardDraft,
  openingBalanceCents,
  parseDayOfMonth,
} from '../../../../core/finances/account-drafts';
import {
  ACCOUNT_KIND_OPTIONS,
  Account,
  AccountDraft,
  AccountKind,
} from '../../../../core/finances/finance-references';
import {
  amountText,
  isValidAmount,
  parseAmountCents,
  signedAmountText,
} from '../../../../core/finances/money';

/**
 * Inline form for a bank account (name and opening balance) or a credit card (name, limit, closing
 * and due days). Adds a new account, or edits (and deletes) the one given in `account`; an account
 * keeps its kind once saved.
 */
@Component({
  selector: 'app-account-form',
  templateUrl: './account-form.html',
  styleUrl: './account-form.css',
})
export class AccountForm {
  /** The account being edited; leave unset to add a new one. */
  readonly account = input<Account | undefined>(undefined);
  readonly save = output<AccountDraft>();
  readonly dismiss = output();
  readonly remove = output();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterNextRender(() =>
      this.host.nativeElement.querySelector<HTMLInputElement>('input[name="name"]')?.focus(),
    );
  }

  protected readonly kindOptions = ACCOUNT_KIND_OPTIONS;
  protected readonly lastDay = LAST_DAY_OF_MONTH;
  protected readonly isEditing = computed(() => this.account() !== undefined);
  // Linked to the account so the fields refill when the form is pointed at another one.
  protected readonly kind = linkedSignal<AccountKind>(() => this.account()?.kind ?? 'bankAccount');
  protected readonly name = linkedSignal(() => this.account()?.name ?? '');
  protected readonly openingBalance = linkedSignal(() => {
    const cents = this.account()?.openingBalanceCents ?? 0;
    return cents === 0 ? '' : signedAmountText(cents);
  });
  protected readonly limit = linkedSignal(() => {
    const card = this.account()?.card;
    return card === undefined ? '' : amountText(card.limitCents);
  });
  protected readonly closingDay = linkedSignal(() =>
    String(this.account()?.card?.closingDay ?? ''),
  );
  protected readonly dueDay = linkedSignal(() => String(this.account()?.card?.dueDay ?? ''));
  protected readonly isCard = computed(() => this.kind() === 'creditCard');

  protected readonly balanceError = computed(() =>
    openingBalanceCents(this.openingBalance()) === undefined
      ? 'Enter a balance like 1500.00, or -150.00 when overdrawn.'
      : undefined,
  );
  protected readonly limitError = computed(() =>
    this.limit().trim() !== '' && !isValidAmount(parseAmountCents(this.limit()))
      ? 'Enter a limit above zero, like 5000.00.'
      : undefined,
  );
  protected readonly daysError = computed(() =>
    [this.closingDay(), this.dueDay()].some(
      (day) => day.trim() !== '' && parseDayOfMonth(day) === undefined,
    )
      ? `Enter days of the month from 1 to ${LAST_DAY_OF_MONTH}.`
      : undefined,
  );
  private readonly draft = computed(() =>
    this.isCard()
      ? creditCardDraft(this.name(), cardTermsFrom(this.limit(), this.closingDay(), this.dueDay()))
      : bankAccountDraft(this.name(), this.openingBalance()),
  );
  protected readonly canSave = computed(() => this.draft() !== undefined);

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    const draft = this.draft();
    if (draft !== undefined) this.save.emit(draft);
  }

  protected readonly valueOf = fieldValue;
}
