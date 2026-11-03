import { Observable, of, throwError } from 'rxjs';
import { Bill, BillDraft, BillSettlement, BillsAgenda } from './bills';
import { BillsGateway } from './bills-gateway';

/** Overdue rent to pay, a freelance payment to receive soon, and an installment already paid. */
export const SAMPLE_BILLS: readonly Bill[] = [
  {
    id: 'rent',
    kind: 'payable',
    description: 'Rent',
    categoryId: 'food',
    amountCents: 150000,
    dueDate: '2026-10-30',
  },
  {
    id: 'freelance',
    kind: 'receivable',
    description: 'Freelance job',
    categoryId: 'salary',
    amountCents: 80000,
    dueDate: '2026-11-05',
  },
  {
    id: 'course',
    kind: 'payable',
    description: 'Course',
    categoryId: 'health',
    amountCents: 9000,
    dueDate: '2026-11-20',
    series: { seriesId: 'course', recurrence: 'installments', number: 2, count: 6 },
  },
  {
    id: 'gym',
    kind: 'payable',
    description: 'Gym',
    categoryId: 'health',
    amountCents: 12000,
    dueDate: '2026-10-25',
    settlement: { date: '2026-10-26', accountId: 'checking-account' },
  },
];

/** The sample credit card's invoice that closed, still to be paid. */
export const SAMPLE_INVOICES: BillsAgenda['cardInvoices'] = [
  { cardId: 'credit-card', dueOn: '2026-11-10', amountCents: 28640, isClosed: true },
];

/** Test double answering synchronously from memory; set `failure` to make the next calls fail. */
export class FakeBillsGateway extends BillsGateway {
  failure: Error | undefined;
  agendaToServe: BillsAgenda = { bills: SAMPLE_BILLS, cardInvoices: SAMPLE_INVOICES };
  readonly saved: { billId: string; draft: BillDraft }[] = [];
  readonly deleted: string[] = [];
  readonly settled: { billId: string; settlement: BillSettlement }[] = [];
  readonly reopened: string[] = [];
  /** Days `agenda` was asked for, in order. */
  readonly askedDays: string[] = [];

  override agenda(asOf: string): Observable<BillsAgenda> {
    this.askedDays.push(asOf);
    return this.answer(this.agendaToServe);
  }

  override save(billId: string, draft: BillDraft): Observable<readonly Bill[]> {
    this.saved.push({ billId, draft });
    const { kind, description, categoryId, amountCents, dueDate } = draft;
    return this.answer([{ id: billId, kind, description, categoryId, amountCents, dueDate }]);
  }

  override delete(billId: string): Observable<void> {
    this.deleted.push(billId);
    return this.answer(undefined);
  }

  override settle(billId: string, settlement: BillSettlement): Observable<Bill> {
    this.settled.push({ billId, settlement });
    const bill = this.agendaToServe.bills.find((current) => current.id === billId);
    return this.answer({ ...(bill ?? SAMPLE_BILLS[0]), settlement });
  }

  override reopen(billId: string): Observable<Bill> {
    this.reopened.push(billId);
    const bill = this.agendaToServe.bills.find((current) => current.id === billId);
    return this.answer({ ...(bill ?? SAMPLE_BILLS[0]), settlement: undefined });
  }

  private answer<TValue>(value: TValue): Observable<TValue> {
    return this.failure === undefined ? of(value) : throwError(() => this.failure);
  }
}
