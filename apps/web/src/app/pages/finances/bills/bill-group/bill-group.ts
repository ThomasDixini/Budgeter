import { NgTemplateOutlet } from '@angular/common';
import { Component, LOCALE_ID, inject, input, output } from '@angular/core';
import { shortDateLabel } from '../../../../core/calendar/date-label';
import {
  AgendaItem,
  Bill,
  CardInvoiceDue,
  dueLabel,
  seriesLabel,
} from '../../../../core/finances/bills';
import { formatSignedMoney } from '../../../../core/finances/money';

/**
 * One block of the agenda (overdue, due soon, later or settled): a row per bill or card invoice, with
 * the action that fits it. A bill's row opens it for editing; the action button settles it.
 */
@Component({
  selector: 'app-bill-group',
  imports: [NgTemplateOutlet],
  templateUrl: './bill-group.html',
  styleUrl: './bill-group.css',
})
export class BillGroup {
  readonly title = input.required<string>();
  readonly items = input.required<readonly AgendaItem[]>();
  readonly categoryNames = input.required<ReadonlyMap<string, string>>();
  readonly accountNames = input.required<ReadonlyMap<string, string>>();
  readonly today = input.required<string>();
  /** Whether the group lists settled bills: their rows are read-only and the action undoes them. */
  readonly settled = input(false);
  readonly settle = output<Bill>();
  readonly edit = output<Bill>();
  readonly reopen = output<Bill>();
  readonly payInvoice = output<CardInvoiceDue>();

  private readonly locale = inject(LOCALE_ID);

  protected signed(item: AgendaItem): string {
    return formatSignedMoney(
      item.kind === 'payable' ? -item.amountCents : item.amountCents,
      this.locale,
    );
  }

  protected total(): string {
    const cents = this.items().reduce(
      (sum, item) => sum + (item.kind === 'payable' ? -item.amountCents : item.amountCents),
      0,
    );
    return formatSignedMoney(cents, this.locale);
  }

  protected actionLabel(item: AgendaItem): string {
    if (this.settled()) return 'Undo';
    if (item.invoice !== undefined) return 'Pay invoice';
    return item.kind === 'payable' ? 'Mark paid' : 'Mark received';
  }

  /** The second line of a row: category and where the due date stands, or when it was settled. */
  protected detail(item: AgendaItem): string {
    const settlement = item.bill?.settlement;
    if (settlement !== undefined) {
      const verb = item.kind === 'payable' ? 'Paid' : 'Received';
      const account = this.accountNames().get(settlement.accountId);
      const where = account === undefined ? '' : ` · ${account}`;
      return `${verb} ${shortDateLabel(settlement.date, this.locale)}${where}`;
    }
    const category =
      item.bill === undefined ? 'Card invoice' : this.categoryNames().get(item.bill.categoryId);
    const due = `${dueLabel(item.dueDate, this.today())} (${shortDateLabel(item.dueDate, this.locale)})`;
    return category === undefined ? due : `${category} · ${due}`;
  }

  protected series(item: AgendaItem): string | undefined {
    return seriesLabel(item.bill?.series);
  }

  protected rowLabel(item: AgendaItem): string {
    return `Edit ${item.description}, ${this.signed(item)}`;
  }

  protected act(item: AgendaItem): void {
    if (item.invoice !== undefined) this.payInvoice.emit(item.invoice);
    else if (item.bill?.settlement !== undefined) this.reopen.emit(item.bill);
    else if (item.bill !== undefined) this.settle.emit(item.bill);
  }
}
