import { Component, LOCALE_ID, computed, inject, signal } from '@angular/core';
import { formatDate } from '@angular/common';
import { LoadFailed } from '../../../components/load-failed/load-failed';
import { PageHeading } from '../../../components/page-heading/page-heading';
import { parseIsoDate } from '../../../core/calendar/date-label';
import {
  AccountMovement,
  accountTotals,
  bankMovements,
  invoiceMovements,
} from '../../../core/finances/account-activity';
import { CardPaymentDraft, suggestedPaymentCents } from '../../../core/finances/account-statement';
import { BanksAndCardsStore } from '../../../core/finances/banks-and-cards-store';
import { Account, AccountDraft, namesById } from '../../../core/finances/finance-references';
import { formatBalance, formatMoney } from '../../../core/finances/money';
import { AccountDetail } from './account-detail/account-detail';
import { AccountForm } from './account-form/account-form';
import { AccountTiles } from './account-tiles/account-tiles';
import { PaymentForm } from './payment-form/payment-form';

/** Which account form is open, if any. */
type AccountFormMode = 'closed' | 'new' | 'edit';

/**
 * Banks & Cards: every bank account's balance and every card's invoice, with the selected one in
 * detail. Adds, edits and deletes accounts, and pays card invoices from a bank account.
 */
@Component({
  selector: 'app-finances-accounts',
  imports: [PageHeading, LoadFailed, AccountTiles, AccountDetail, AccountForm, PaymentForm],
  providers: [BanksAndCardsStore],
  templateUrl: './accounts.html',
  styleUrl: './accounts.css',
})
export class Accounts {
  private readonly store = inject(BanksAndCardsStore);
  private readonly locale = inject(LOCALE_ID);

  protected readonly today = this.store.today;
  protected readonly accounts = this.store.accounts;
  protected readonly statements = this.store.statements;
  protected readonly isLoaded = this.store.isLoaded;
  protected readonly hasLoadFailed = this.store.hasLoadFailed;
  protected readonly accountForm = signal<AccountFormMode>('closed');
  protected readonly isPaying = signal(false);
  private readonly chosenId = signal<string | undefined>(undefined);

  /** The account chosen on the tiles, or the first one until one is chosen. */
  protected readonly selected = computed(
    () => this.accounts().find((account) => account.id === this.chosenId()) ?? this.accounts()[0],
  );
  protected readonly selectedStatement = computed(() => {
    const account = this.selected();
    return account === undefined ? undefined : this.statements().get(account.id);
  });
  protected readonly bankAccounts = computed(() =>
    this.accounts().filter((account) => account.kind === 'bankAccount'),
  );
  protected readonly categoryNames = computed(() => namesById(this.store.categories()));
  protected readonly monthName = computed(() =>
    formatDate(parseIsoDate(this.today), 'MMMM', this.locale),
  );
  protected readonly movements = computed(() => this.movementsOf(this.selected()));
  protected readonly suggestedPayment = computed(() => {
    const card = this.selectedStatement()?.card;
    return card === undefined ? 0 : suggestedPaymentCents(card);
  });
  protected readonly totalsLine = computed(() => this.describeTotals());

  protected choose(accountId: string): void {
    this.chosenId.set(accountId);
    this.isPaying.set(false);
    if (this.accountForm() === 'edit') this.accountForm.set('closed');
  }

  protected openAccountForm(mode: 'new' | 'edit'): void {
    this.isPaying.set(false);
    this.accountForm.set(mode);
  }

  protected closeAccountForm(): void {
    this.accountForm.set('closed');
  }

  /**
   * Adds the form's account and selects it, or saves the edit of the selected one.
   * @example this.saveAccount({ name: 'Nubank', kind: 'bankAccount', openingBalanceCents: 0 })
   */
  protected saveAccount(draft: AccountDraft): void {
    const editing = this.accountForm() === 'edit' ? this.selected() : undefined;
    if (editing === undefined) this.chosenId.set(this.store.addAccount(draft).id);
    else this.store.updateAccount(editing.id, draft);
    this.closeAccountForm();
  }

  protected deleteAccount(): void {
    const account = this.selected();
    if (account !== undefined) this.store.deleteAccount(account.id);
    this.chosenId.set(undefined);
    this.closeAccountForm();
  }

  protected openPayment(): void {
    this.accountForm.set('closed');
    this.isPaying.set(true);
  }

  protected closePayment(): void {
    this.isPaying.set(false);
  }

  protected pay(draft: CardPaymentDraft): void {
    this.store.payInvoice(draft);
    this.closePayment();
  }

  protected removePayment(paymentId: string): void {
    this.store.deletePayment(paymentId);
  }

  protected reload(): void {
    this.store.reload();
  }

  private movementsOf(account: Account | undefined): AccountMovement[] {
    if (account === undefined) return [];
    const transactions = this.store.transactions();
    if (account.kind === 'bankAccount') {
      const span = { month: this.store.month, today: this.today };
      const cardNames = namesById(this.accounts());
      return bankMovements(transactions, this.store.payments(), account.id, span, cardNames);
    }
    const invoice = this.statements().get(account.id)?.card?.openInvoice;
    return invoice === undefined
      ? []
      : invoiceMovements(transactions, account.id, invoice, this.today);
  }

  private describeTotals(): string {
    if (!this.isLoaded()) return 'In accounts: — · Open invoices: —';
    const balances = new Map(
      [...this.statements().values()].map((statement) => [
        statement.accountId,
        statement.balanceCents,
      ]),
    );
    const totals = accountTotals(this.accounts(), balances);
    const inAccounts = formatBalance(totals.bankBalanceCents, this.locale);
    return `In accounts: ${inAccounts} · Open invoices: ${formatMoney(totals.cardOwedCents, this.locale)}`;
  }
}
