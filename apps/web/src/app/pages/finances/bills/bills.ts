import { Component, LOCALE_ID, computed, inject, signal } from '@angular/core';
import { LoadFailed } from '../../../components/load-failed/load-failed';
import { PageHeading } from '../../../components/page-heading/page-heading';
import { CardPaymentDraft } from '../../../core/finances/account-statement';
import {
  AgendaItem,
  AgendaGroups,
  Bill,
  BillDraft,
  BillKind,
  DueTotals,
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
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

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
  imports: [TranslatePipe, PageHeading, LoadFailed, BillForm, SettleForm, PaymentForm, BillGroup],
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
  protected readonly kindOptions: readonly { value: BillKind; label: string }[] = [
    { value: 'payable', label: 'To pay' },
    { value: 'receivable', label: 'To receive' },
  ];
  protected readonly kindFilter = signal<BillKind | undefined>(undefined);
  protected readonly visible = computed(() => this.filterGroups(this.groups()));
  protected readonly leftToPay = computed(() => this.money(this.openTotals().payableCents));
  protected readonly leftToReceive = computed(() => this.money(this.openTotals().receivableCents));
  protected readonly projectedBalance = computed(() => this.describeBalance());
  protected readonly overdueCount = computed(() => this.describeOverdue());
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

  /** Picks a kind to show, or goes back to showing both when it is already the one picked. */
  protected toggleKind(kind: BillKind): void {
    this.kindFilter.update((current) => (current === kind ? undefined : kind));
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

  private openTotals(): DueTotals {
    const groups = this.groups();
    return dueTotals([...groups.overdue, ...groups.soon, ...groups.later]);
  }

  private describeBalance(): string {
    const { payableCents, receivableCents } = this.openTotals();
    const balance = receivableCents - payableCents;
    return `${balance < 0 ? '−' : '+'}${this.money(Math.abs(balance))}`;
  }

  private describeOverdue(): string {
    const count = this.groups().overdue.length;
    return count === 1 ? '1 bill' : `${count} bills`;
  }

  private filterGroups(groups: AgendaGroups): AgendaGroups {
    const kind = this.kindFilter();
    if (kind === undefined) return groups;
    const keep = (items: readonly AgendaItem[]): AgendaItem[] =>
      items.filter((item) => item.kind === kind);
    return {
      overdue: keep(groups.overdue),
      soon: keep(groups.soon),
      later: keep(groups.later),
      settled: keep(groups.settled),
    };
  }

  private money(cents: number): string {
    return formatMoney(cents, this.locale);
  }
}
