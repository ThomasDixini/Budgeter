import { ErrorHandler, Injectable, computed, inject, signal } from '@angular/core';
import { Observable, finalize, shareReplay, switchMap } from 'rxjs';
import { Clock } from '../calendar/clock';
import { isoDate } from '../calendar/date-label';
import { IdGenerator } from '../ids/id-generator';
import { positionOf, restoredAt, sameId } from '../lists/list-positions';
import { CardPayment, CardPaymentDraft } from './account-statement';
import { AccountStatementsGateway } from './account-statements-gateway';
import {
  AgendaItem,
  Bill,
  BillDraft,
  BillSettlement,
  CardInvoiceDue,
  billItem,
  groupAgenda,
  invoiceItem,
} from './bills';
import { BillsGateway } from './bills-gateway';
import { namesById } from './finance-references';
import { FinanceReferencesStore } from './finance-references-store';

/**
 * What the "To pay & receive" page shows: the open and recently settled bills, plus the card invoices
 * still to be paid. Provided by the page, so each visit loads fresh data. Changes apply on screen first
 * and are put back if the gateway rejects them.
 */
@Injectable()
export class BillsStore {
  private readonly references = inject(FinanceReferencesStore);
  private readonly gateway = inject(BillsGateway);
  private readonly statementsGateway = inject(AccountStatementsGateway);
  private readonly ids = inject(IdGenerator);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly billList = signal<readonly Bill[]>([]);
  private readonly invoiceList = signal<readonly CardInvoiceDue[]>([]);
  private readonly agendaLoaded = signal(false);
  private readonly loadFailed = signal(false);
  /** Counts agenda requests, so an answer overtaken by a newer one is dropped. */
  private agendaRequest = 0;
  /** Bills the API has not stored yet; a change to one waits for that, or it could arrive first. */
  private readonly creations = new Map<string, Observable<unknown>>();

  /** Today, `YYYY-MM-DD`: what is overdue and what is due soon are counted from it. */
  readonly today = isoDate(inject(Clock).now());
  readonly accounts = this.references.accounts;
  readonly categories = this.references.categories;
  readonly isLoaded = computed(() => this.agendaLoaded() && this.references.isLoaded());
  readonly hasLoadFailed = computed(() => this.loadFailed() || this.references.hasLoadFailed());
  readonly groups = computed(() => groupAgenda(this.items(), this.today));

  private readonly items = computed<AgendaItem[]>(() => {
    const cardNames = namesById(this.accounts());
    return [
      ...this.billList().map(billItem),
      ...this.invoiceList().map((invoice) =>
        invoiceItem(invoice, cardNames.get(invoice.cardId) ?? 'Card'),
      ),
    ];
  });

  constructor() {
    this.loadAgenda();
  }

  /**
   * Loads again whatever did not arrive, after a failed load.
   * @example store.reload()
   */
  reload(): void {
    this.references.reload();
    this.loadFailed.set(false);
    if (!this.agendaLoaded()) this.loadAgenda();
  }

  /**
   * Reads the agenda again, for bills created on the server behind this store's back (such as the ones
   * a sinking fund roll adds). The bills on screen stay until the new answer arrives.
   * @example store.refreshAgenda()
   */
  refreshAgenda(): void {
    this.loadAgenda();
  }

  /**
   * Adds a bill. A repeating one shows its first occurrence at once and the others once stored.
   * @example store.add({ kind: 'payable', description: 'Rent', categoryId: 'housing', amountCents: 150000, dueDate: '2026-11-05' })
   */
  add(draft: BillDraft): Bill {
    const bill = this.newBill(this.ids.next(), draft);
    this.billList.update((list) => [...list, bill]);
    const saved = this.gateway
      .save(bill.id, draft)
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    this.creations.set(bill.id, saved);
    saved.pipe(finalize(() => this.creations.delete(bill.id))).subscribe({
      next: () => {
        if (draft.repeat !== undefined) this.loadAgenda();
      },
      error: (error: unknown) => {
        this.billList.update((list) => list.filter((current) => current.id !== bill.id));
        this.errorHandler.handleError(error);
      },
    });
    return bill;
  }

  /**
   * Replaces an open bill; the previous version comes back if the gateway rejects it.
   * @example store.update('rent', { ...draft, amountCents: 160000 })
   */
  update(billId: string, draft: BillDraft): void {
    const previous = positionOf(this.billList(), (current) => current.id === billId);
    if (previous === undefined) return;
    const bill: Bill = { ...this.newBill(billId, draft), series: previous.record.series };
    this.replace(previous.record, bill);
    this.afterCreation(billId, () => this.gateway.save(billId, draft)).subscribe({
      error: (error: unknown) => this.rollback(bill, previous.record, error),
    });
  }

  /**
   * Deletes one bill; puts it back in place if the gateway rejects it.
   * @example store.remove('rent')
   */
  remove(billId: string): void {
    const removed = positionOf(this.billList(), (current) => current.id === billId);
    this.billList.update((list) => list.filter((current) => current.id !== billId));
    this.afterCreation(billId, () => this.gateway.delete(billId)).subscribe({
      error: (error: unknown) => {
        if (removed !== undefined)
          this.billList.update((list) => restoredAt(list, removed, sameId));
        this.errorHandler.handleError(error);
      },
    });
  }

  /**
   * Marks a bill paid or received through an account on a day.
   * @example store.settle('rent', { date: '2026-11-03', accountId: 'checking-account' })
   */
  settle(billId: string, settlement: BillSettlement): void {
    const previous = positionOf(this.billList(), (current) => current.id === billId);
    if (previous === undefined) return;
    const settled: Bill = { ...previous.record, settlement };
    this.replace(previous.record, settled);
    this.afterCreation(billId, () => this.gateway.settle(billId, settlement)).subscribe({
      error: (error: unknown) => this.rollback(settled, previous.record, error),
    });
  }

  /**
   * Undoes a settlement, so the bill is open again.
   * @example store.reopen('rent')
   */
  reopen(billId: string): void {
    const previous = positionOf(this.billList(), (current) => current.id === billId);
    if (previous === undefined) return;
    const reopened: Bill = { ...previous.record, settlement: undefined };
    this.replace(previous.record, reopened);
    this.afterCreation(billId, () => this.gateway.reopen(billId)).subscribe({
      error: (error: unknown) => this.rollback(reopened, previous.record, error),
    });
  }

  /**
   * Pays a card invoice from a bank account: the invoice leaves the list at once and the agenda is read
   * again once the payment is stored. It comes back if the payment is rejected.
   * @example store.payInvoice({ cardId: 'credit-card', fromAccountId: 'checking-account', date: '2026-11-03', amountCents: 28640 })
   */
  payInvoice(draft: CardPaymentDraft): void {
    const invoices = this.invoiceList();
    const payment: CardPayment = { ...draft, id: this.ids.next() };
    this.invoiceList.update((list) => withoutPaidInvoice(list, draft));
    this.statementsGateway.savePayment(payment).subscribe({
      next: () => this.loadAgenda(),
      error: (error: unknown) => {
        this.invoiceList.set(invoices);
        this.errorHandler.handleError(error);
      },
    });
  }

  private afterCreation<TResult>(
    billId: string,
    change: () => Observable<TResult>,
  ): Observable<TResult> {
    const creation = this.creations.get(billId);
    return creation === undefined ? change() : creation.pipe(switchMap(change));
  }

  // An agenda read before a new bill was stored does not list it yet; it must not make the bill vanish.
  private withPendingCreations(stored: readonly Bill[]): Bill[] {
    const storedIds = new Set(stored.map((bill) => bill.id));
    const pending = this.billList().filter(
      (bill) => this.creations.has(bill.id) && !storedIds.has(bill.id),
    );
    return [...stored, ...pending];
  }

  private newBill(billId: string, draft: BillDraft): Bill {
    const { repeat, ...fields } = draft;
    const series =
      repeat === undefined
        ? undefined
        : { seriesId: billId, recurrence: repeat.kind, number: 1, count: repeat.count };
    return { id: billId, ...fields, series };
  }

  private replace(previous: Bill, bill: Bill): void {
    this.billList.update((list) => list.map((current) => (current === previous ? bill : current)));
  }

  // Puts the previous version back only if this change is still the one shown.
  private rollback(applied: Bill, previous: Bill, error: unknown): void {
    this.replace(applied, previous);
    this.errorHandler.handleError(error);
  }

  private loadAgenda(): void {
    const request = ++this.agendaRequest;
    this.gateway.agenda(this.today).subscribe({
      next: (agenda) => {
        if (request !== this.agendaRequest) return;
        this.billList.set(this.withPendingCreations(agenda.bills));
        this.invoiceList.set(agenda.cardInvoices);
        this.agendaLoaded.set(true);
      },
      error: (error: unknown) => {
        if (request !== this.agendaRequest) return;
        this.loadFailed.set(true);
        this.errorHandler.handleError(error);
      },
    });
  }
}

// A payment settles the oldest debt first, so it clears the card's earliest invoice when it covers it;
// a smaller one waits for the agenda to be read again with the reduced amount.
function withoutPaidInvoice(
  invoices: readonly CardInvoiceDue[],
  payment: CardPaymentDraft,
): CardInvoiceDue[] {
  const oldest = invoices
    .filter((invoice) => invoice.cardId === payment.cardId)
    .slice()
    .sort((first, second) => first.dueOn.localeCompare(second.dueOn))[0];
  const isCovered = oldest !== undefined && payment.amountCents >= oldest.amountCents;
  return invoices.filter((invoice) => !isCovered || invoice !== oldest);
}
