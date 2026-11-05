import { Component, LOCALE_ID, computed, inject, signal } from '@angular/core';
import { LoadFailed } from '../../../components/load-failed/load-failed';
import { PageHeading } from '../../../components/page-heading/page-heading';
import { CardPaymentDraft } from '../../../core/finances/account-statement';
import {
  AgendaItem,
  Bill,
  BillDraft,
  BillSettlement,
  CardInvoiceDue,
  dueTotals,
} from '../../../core/finances/bills';
import { BillsStore } from '../../../core/finances/bills-store';
import { namesById } from '../../../core/finances/finance-references';
import { formatMoney } from '../../../core/finances/money';
import { BillForm } from './bill-form/bill-form';
import { BillGroup } from './bill-group/bill-group';
import { SettleForm } from './settle-form/settle-form';
import { PaymentForm } from '../accounts/payment-form/payment-form';

/** The inline form open above the lists, if any. */
type Panel =
  | { readonly kind: 'closed' }
  | { readonly kind: 'new' }
  | { readonly kind: 'edit'; readonly billId: string }
  | { readonly kind: 'settle'; readonly billId: string }
  | { readonly kind: 'pay'; readonly invoice: CardInvoiceDue };

const CLOSED: Panel = { kind: 'closed' };

/**
 * To pay & receive: bills and card invoices by due date (overdue, due in the next days, later) and the
 * ones settled recently. Adds, edits and deletes bills, marks them paid or received, and pays card
 * invoices from a bank account.
 */
@Component({
  selector: 'app-finances-bills',
  imports: [PageHeading, LoadFailed, BillForm, SettleForm, PaymentForm, BillGroup],
  providers: [BillsStore],
  templateUrl: './bills.html',
  styleUrl: './bills.css',
})
export class Bills {
  private readonly store = inject(BillsStore);
  private readonly locale = inject(LOCALE_ID);

  protected readonly today = this.store.today;
  protected readonly groups = this.store.groups;
  protected readonly categories = this.store.categories;
  protected readonly accounts = this.store.accounts;
  protected readonly isLoaded = this.store.isLoaded;
  protected readonly hasLoadFailed = this.store.hasLoadFailed;
  protected readonly panel = signal<Panel>(CLOSED);

  protected readonly categoryNames = computed(() => namesById(this.categories()));
  protected readonly accountNames = computed(() => namesById(this.accounts()));
  protected readonly bankAccounts = computed(() =>
    this.accounts().filter((account) => account.kind === 'bankAccount'),
  );
  protected readonly isEmpty = computed(() => {
    const groups = this.groups();
    return [groups.overdue, groups.soon, groups.later, groups.settled].every(
      (items) => items.length === 0,
    );
  });
  protected readonly summary = computed(() => this.describeSummary());
  protected readonly panelBill = computed(() => this.billOfPanel());
  protected readonly payingCard = computed(() => {
    const panel = this.panel();
    return panel.kind === 'pay'
      ? this.accounts().find((account) => account.id === panel.invoice.cardId)
      : undefined;
  });

  protected open(panel: Panel): void {
    this.panel.set(panel);
  }

  protected close(): void {
    this.panel.set(CLOSED);
  }

  /**
   * Adds the form's bill, or saves the edit of the one being edited.
   * @example this.saveBill({ kind: 'payable', description: 'Rent', categoryId: 'housing', amountCents: 150000, dueDate: '2026-11-05' })
   */
  protected saveBill(draft: BillDraft): void {
    const panel = this.panel();
    if (panel.kind === 'edit') this.store.update(panel.billId, draft);
    else this.store.add(draft);
    this.close();
  }

  protected deleteBill(): void {
    const panel = this.panel();
    if (panel.kind === 'edit') this.store.remove(panel.billId);
    this.close();
  }

  protected settleBill(settlement: BillSettlement): void {
    const panel = this.panel();
    if (panel.kind === 'settle') this.store.settle(panel.billId, settlement);
    this.close();
  }

  protected reopenBill(bill: Bill): void {
    this.store.reopen(bill.id);
  }

  protected payInvoice(draft: CardPaymentDraft): void {
    this.store.payInvoice(draft);
    this.close();
  }

  protected suggestedPayment(): number {
    const panel = this.panel();
    return panel.kind === 'pay' ? panel.invoice.amountCents : 0;
  }

  protected reload(): void {
    this.store.reload();
  }

  private billOfPanel(): Bill | undefined {
    const panel = this.panel();
    if (panel.kind !== 'edit' && panel.kind !== 'settle') return undefined;
    return this.allItems()
      .map((item) => item.bill)
      .find((bill) => bill?.id === panel.billId);
  }

  private allItems(): AgendaItem[] {
    const groups = this.groups();
    return [...groups.overdue, ...groups.soon, ...groups.later, ...groups.settled];
  }

  private describeSummary(): string {
    if (!this.isLoaded()) return 'Overdue: — · Next 7 days: —';
    const groups = this.groups();
    const overdue = dueTotals(groups.overdue);
    const soon = dueTotals(groups.soon);
    const money = (cents: number): string => formatMoney(cents, this.locale);
    return (
      `Overdue: ${money(overdue.payableCents)} to pay, ${money(overdue.receivableCents)} to receive · ` +
      `Next 7 days: ${money(soon.payableCents)} to pay, ${money(soon.receivableCents)} to receive`
    );
  }
}
