import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { Clock } from '../calendar/clock';
import { FixedClock } from '../calendar/fixed-clock';
import { IdGenerator } from '../ids/id-generator';
import { SequentialIdGenerator } from '../ids/sequential-id-generator';
import { AccountStatementsGateway } from './account-statements-gateway';
import { Bill, BillDraft, BillsAgenda } from './bills';
import { BillsGateway } from './bills-gateway';
import { BillsStore } from './bills-store';
import { FakeAccountStatementsGateway } from './fake-account-statements-gateway';
import { FakeBillsGateway } from './fake-bills-gateway';
import { FakeFinanceReferencesGateway } from './fake-finances-gateways';
import { FinanceReferencesGateway } from './transactions-gateway';

/** Tuesday, November 3, 2026. */
const NOW = new Date(2026, 10, 3, 9, 0);

const NEW_BILL: BillDraft = {
  kind: 'payable',
  description: 'Internet',
  categoryId: 'food',
  amountCents: 11990,
  dueDate: '2026-11-08',
};

/** Records reported errors instead of logging them. */
class RecordingErrorHandler extends ErrorHandler {
  readonly errors: unknown[] = [];

  override handleError(error: unknown): void {
    this.errors.push(error);
  }
}

/** Saves that stay open until a test answers them, to play out a change made before the bill is stored. */
class ControlledSaveGateway extends FakeBillsGateway {
  readonly pendingSaves: Subject<readonly Bill[]>[] = [];

  override save(billId: string, draft: BillDraft): Observable<readonly Bill[]> {
    this.saved.push({ billId, draft });
    const reply = new Subject<readonly Bill[]>();
    this.pendingSaves.push(reply);
    return reply;
  }
}

/** An agenda that stays open until a test answers it, to play out a read overtaken by an add. */
class ControlledAgendaGateway extends ControlledSaveGateway {
  readonly pendingAgendas: Subject<BillsAgenda>[] = [];

  override agenda(asOf: string): Observable<BillsAgenda> {
    this.askedDays.push(asOf);
    const reply = new Subject<BillsAgenda>();
    this.pendingAgendas.push(reply);
    return reply;
  }
}

function createStore(
  gateway = new FakeBillsGateway(),
  statements = new FakeAccountStatementsGateway(),
): { store: BillsStore; errors: RecordingErrorHandler } {
  const errors = new RecordingErrorHandler();
  TestBed.configureTestingModule({
    providers: [
      BillsStore,
      { provide: BillsGateway, useValue: gateway },
      { provide: AccountStatementsGateway, useValue: statements },
      { provide: FinanceReferencesGateway, useValue: new FakeFinanceReferencesGateway() },
      { provide: Clock, useValue: new FixedClock(NOW) },
      { provide: IdGenerator, useValue: new SequentialIdGenerator() },
      { provide: ErrorHandler, useValue: errors },
    ],
  });
  return { store: TestBed.inject(BillsStore), errors };
}

function keys(items: readonly { key: string }[]): string[] {
  return items.map((item) => item.key);
}

describe('BillsStore loading', () => {
  it("asks for today's agenda and groups it by urgency", () => {
    const gateway = new FakeBillsGateway();
    const { store } = createStore(gateway);

    expect(gateway.askedDays).toEqual(['2026-11-03']);
    expect(store.isLoaded()).toBe(true);
    expect([
      keys(store.groups().overdue),
      keys(store.groups().soon),
      keys(store.groups().later),
      keys(store.groups().settled),
    ]).toEqual([
      ['bill:rent'],
      ['bill:freelance'],
      ['invoice:credit-card:2026-11-10', 'bill:course'],
      ['bill:gym'],
    ]);
  });

  it('offers to try again when the agenda does not arrive', () => {
    const gateway = new FakeBillsGateway();
    gateway.failure = new Error('offline');
    const { store, errors } = createStore(gateway);

    gateway.failure = undefined;
    store.reload();

    expect([errors.errors.length > 0, store.hasLoadFailed(), store.isLoaded()]).toEqual([
      true,
      false,
      true,
    ]);
  });
});

describe('BillsStore changes', () => {
  it('shows an added bill at once and sends it with its new id', () => {
    const gateway = new FakeBillsGateway();
    const { store } = createStore(gateway);

    const bill = store.add(NEW_BILL);

    expect([bill.id, gateway.saved[0].billId, keys(store.groups().soon)]).toEqual([
      'id-1',
      'id-1',
      ['bill:freelance', 'bill:id-1'],
    ]);
  });

  it('reads the agenda again after adding a repeating bill, for its other occurrences', () => {
    const gateway = new FakeBillsGateway();
    const { store } = createStore(gateway);

    store.add({ ...NEW_BILL, repeat: { kind: 'installments', count: 3 } });

    expect(gateway.askedDays.length).toBe(2);
  });

  it('drops an added bill the API rejects', () => {
    const gateway = new FakeBillsGateway();
    const { store } = createStore(gateway);
    gateway.failure = new Error('rejected');

    store.add(NEW_BILL);

    expect(keys(store.groups().soon)).toEqual(['bill:freelance']);
  });

  it('edits a bill keeping its place in a series, and restores it on failure', () => {
    const gateway = new FakeBillsGateway();
    const { store } = createStore(gateway);

    store.update('course', { ...NEW_BILL, description: 'Course', dueDate: '2026-11-21' });
    const edited = store.groups().later.find((item) => item.bill?.id === 'course')!.bill!;
    gateway.failure = new Error('rejected');
    store.update('course', { ...NEW_BILL, description: 'Other' });

    expect([edited.dueDate, edited.series?.number]).toEqual(['2026-11-21', 2]);
    expect(store.groups().later.find((item) => item.bill?.id === 'course')!.bill).toBe(edited);
  });

  it('removes a bill and puts it back where it was if the API rejects that', () => {
    const gateway = new FakeBillsGateway();
    const { store } = createStore(gateway);

    store.remove('freelance');
    expect(keys(store.groups().soon)).toEqual([]);
    gateway.failure = new Error('rejected');
    store.remove('rent');

    expect(keys(store.groups().overdue)).toEqual(['bill:rent']);
  });

  it('moves a settled bill to the settled group and back when reopened', () => {
    const gateway = new FakeBillsGateway();
    const { store } = createStore(gateway);

    store.settle('rent', { date: '2026-11-03', accountId: 'checking-account' });
    const afterSettling = keys(store.groups().settled);
    store.reopen('rent');

    expect([afterSettling, keys(store.groups().overdue), gateway.reopened]).toEqual([
      ['bill:rent', 'bill:gym'],
      ['bill:rent'],
      ['rent'],
    ]);
  });

  it('keeps a bill open when the settlement is rejected', () => {
    const gateway = new FakeBillsGateway();
    const { store, errors } = createStore(gateway);
    gateway.failure = new Error('rejected');

    store.settle('rent', { date: '2026-11-03', accountId: 'checking-account' });

    expect([keys(store.groups().overdue), errors.errors.length]).toEqual([['bill:rent'], 1]);
  });
});

describe('BillsStore ordering', () => {
  it('keeps a new bill the API has not stored yet when an older agenda arrives', () => {
    const gateway = new ControlledAgendaGateway();
    const { store } = createStore(gateway);
    store.add(NEW_BILL);

    gateway.pendingAgendas[0].next({ bills: [], cardInvoices: [] });

    expect(keys(store.groups().soon)).toEqual(['bill:id-1']);
  });

  it('sends a change to a new bill only once the bill is stored', () => {
    const gateway = new ControlledSaveGateway();
    const { store } = createStore(gateway);
    const bill = store.add(NEW_BILL);

    store.settle(bill.id, { date: '2026-11-03', accountId: 'checking-account' });
    const beforeStored = gateway.settled.length;
    gateway.pendingSaves[0].next([bill]);
    gateway.pendingSaves[0].complete();

    expect([beforeStored, gateway.settled.map((request) => request.billId)]).toEqual([
      0,
      [bill.id],
    ]);
  });

  it('rolls the change back when the bill it waited for is rejected', () => {
    const gateway = new ControlledSaveGateway();
    const { store, errors } = createStore(gateway);
    const bill = store.add(NEW_BILL);
    store.settle(bill.id, { date: '2026-11-03', accountId: 'checking-account' });

    gateway.pendingSaves[0].error(new Error('rejected'));

    expect([gateway.settled.length, keys(store.groups().soon), errors.errors.length]).toEqual([
      0,
      ['bill:freelance'],
      2,
    ]);
  });
});

describe('BillsStore card invoices', () => {
  const PAYMENT = {
    cardId: 'credit-card',
    fromAccountId: 'checking-account',
    date: '2026-11-03',
    amountCents: 28640,
  };

  it('records the payment, clears the invoice and reads the agenda again', () => {
    const gateway = new FakeBillsGateway();
    const statements = new FakeAccountStatementsGateway();
    const { store } = createStore(gateway, statements);
    gateway.agendaToServe = { bills: gateway.agendaToServe.bills, cardInvoices: [] };

    store.payInvoice(PAYMENT);

    expect([
      statements.savedPayments[0].amountCents,
      keys(store.groups().later),
      gateway.askedDays.length,
    ]).toEqual([28640, ['bill:course'], 2]);
  });

  it('keeps the invoice when a part payment does not cover it', () => {
    const { store } = createStore();

    store.payInvoice({ ...PAYMENT, amountCents: 1000 });

    expect(keys(store.groups().later)).toContain('invoice:credit-card:2026-11-10');
  });

  it('brings the invoice back when the payment is rejected', () => {
    const statements = new FakeAccountStatementsGateway();
    const { store, errors } = createStore(new FakeBillsGateway(), statements);
    statements.failure = new Error('rejected');

    store.payInvoice(PAYMENT);

    expect([keys(store.groups().later), errors.errors.length]).toEqual([
      ['invoice:credit-card:2026-11-10', 'bill:course'],
      1,
    ]);
  });
});
