import { ErrorHandler } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Clock } from '../../../core/calendar/clock';
import { FixedClock } from '../../../core/calendar/fixed-clock';
import { AccountStatementsGateway } from '../../../core/finances/account-statements-gateway';
import { BillsGateway } from '../../../core/finances/bills-gateway';
import { FakeAccountStatementsGateway } from '../../../core/finances/fake-account-statements-gateway';
import { FakeBillsGateway, SAMPLE_BILLS } from '../../../core/finances/fake-bills-gateway';
import { FakeFinanceReferencesGateway } from '../../../core/finances/fake-finances-gateways';
import {
  FakeSinkingFundsGateway,
  SAMPLE_SINKING_FUND,
} from '../../../core/finances/fake-sinking-funds-gateway';
import { SinkingFundsGateway } from '../../../core/finances/sinking-funds-gateway';
import { FinanceReferencesGateway } from '../../../core/finances/transactions-gateway';
import { IdGenerator } from '../../../core/ids/id-generator';
import { SequentialIdGenerator } from '../../../core/ids/sequential-id-generator';
import { Bills } from './bills';

/** Tuesday, November 3, 2026. */
const NOW = new Date(2026, 10, 3, 9, 0);

/** Swallows the errors the page reports on purpose. */
class SilentErrorHandler extends ErrorHandler {
  override handleError(): void {
    // Reported failures are part of what these tests play out.
  }
}

interface Rendered {
  fixture: ComponentFixture<Bills>;
  bills: FakeBillsGateway;
  statements: FakeAccountStatementsGateway;
  funds: FakeSinkingFundsGateway;
}

function render(bills = new FakeBillsGateway(), funds = new FakeSinkingFundsGateway()): Rendered {
  const statements = new FakeAccountStatementsGateway();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: BillsGateway, useValue: bills },
      { provide: AccountStatementsGateway, useValue: statements },
      { provide: SinkingFundsGateway, useValue: funds },
      { provide: FinanceReferencesGateway, useValue: new FakeFinanceReferencesGateway() },
      { provide: Clock, useValue: new FixedClock(NOW) },
      { provide: IdGenerator, useValue: new SequentialIdGenerator() },
      { provide: ErrorHandler, useClass: SilentErrorHandler },
    ],
  });
  const fixture = TestBed.createComponent(Bills);
  fixture.detectChanges();
  return { fixture, bills, statements, funds };
}

function element(fixture: ComponentFixture<Bills>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function texts(fixture: ComponentFixture<Bills>, selector: string): string[] {
  return [...element(fixture).querySelectorAll(selector)].map(
    (node) => node.textContent?.replaceAll(/\s+/g, ' ').trim() ?? '',
  );
}

function clickButton(fixture: ComponentFixture<Bills>, label: string): void {
  const buttons = [...element(fixture).querySelectorAll<HTMLButtonElement>('button')];
  buttons
    .find(
      (button) =>
        button.getAttribute('aria-label') === label || button.textContent?.trim() === label,
    )!
    .click();
  fixture.detectChanges();
}

function fill(fixture: ComponentFixture<Bills>, selector: string, value: string): void {
  const field = element(fixture).querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
  field.value = value;
  field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input'));
  field.dispatchEvent(new Event('change'));
  fixture.detectChanges();
}

function submit(fixture: ComponentFixture<Bills>, formLabel: string): void {
  element(fixture)
    .querySelector<HTMLButtonElement>(`form[aria-label="${formLabel}"] [type="submit"]`)!
    .click();
  fixture.detectChanges();
}

describe('To pay & receive page', () => {
  it('sums up what is left to pay and receive, the projected balance and what is overdue', () => {
    const { fixture } = render();

    expect(texts(fixture, '.stat .value')).toEqual([
      'R$1,876.40',
      'R$800.00',
      '−R$1,076.40',
      '1 bill',
    ]);
  });

  it('shows only what is to pay, or only what is to receive, and goes back to both', () => {
    const { fixture } = render();

    clickButton(fixture, 'To pay');
    const toPay = texts(fixture, 'app-bill-group .description');
    clickButton(fixture, 'To receive');
    const toReceive = texts(fixture, 'app-bill-group .description');
    clickButton(fixture, 'To receive');

    expect([toPay, toReceive, texts(fixture, 'app-bill-group .description').length]).toEqual([
      ['Rent', 'Credit card invoice', 'Course', 'Gym'],
      ['Freelance job'],
      5,
    ]);
  });

  it('lists bills and card invoices by urgency, then what was settled', () => {
    const { fixture } = render();

    expect([
      texts(fixture, '.group-header span:first-child'),
      texts(fixture, 'app-bill-group .description'),
    ]).toEqual([
      ['Overdue', 'Next 7 days', 'Later', 'Paid & received (last 30 days)'],
      ['Rent', 'Freelance job', 'Credit card invoice', 'Course', 'Gym'],
    ]);
  });

  it('says where each bill stands and the place of an installment in its series', () => {
    const { fixture } = render();

    expect([texts(fixture, 'app-bill-group .detail'), texts(fixture, '.series')]).toEqual([
      [
        'Food · Overdue by 4 days (Oct 30)',
        'Salary · Due in 2 days (Nov 5)',
        'Card invoice · Due in 7 days (Nov 10)',
        'Health · Due in 17 days (Nov 20)',
        'Paid Oct 26 · Checking account',
      ],
      ['Installment 2/6'],
    ]);
  });

  it('marks a bill paid through the first account today', () => {
    const { fixture, bills } = render();

    clickButton(fixture, 'Mark paid: Rent');
    submit(fixture, 'Mark Rent paid');

    expect(bills.settled).toEqual([
      { billId: 'rent', settlement: { date: '2026-11-03', accountId: 'checking-account' } },
    ]);
    expect(texts(fixture, '.group-header span:first-child')).not.toContain('Overdue');
  });

  it('marks a receivable as received', () => {
    const { fixture, bills } = render();

    clickButton(fixture, 'Mark received: Freelance job');
    fill(fixture, 'input[name="date"]', '2026-11-04');
    submit(fixture, 'Mark Freelance job received');

    expect(bills.settled[0].settlement.date).toBe('2026-11-04');
  });

  it('undoes a settlement', () => {
    const { fixture, bills } = render();

    clickButton(fixture, 'Undo: Gym');

    expect(bills.reopened).toEqual(['gym']);
  });

  it('adds a bill that repeats monthly', () => {
    const { fixture, bills } = render();

    clickButton(fixture, 'Add bill');
    fill(fixture, 'input[name="description"]', 'Internet');
    fill(fixture, 'input[name="amount"]', '119,90');
    fill(fixture, 'select[name="category"]', 'food');
    fill(fixture, 'input[name="dueDate"]', '2026-11-08');
    fill(fixture, 'select[name="repeat"]', 'monthly');
    submit(fixture, 'New bill');

    expect(bills.saved).toEqual([
      {
        billId: 'id-1',
        draft: {
          kind: 'payable',
          description: 'Internet',
          categoryId: 'food',
          amountCents: 11990,
          dueDate: '2026-11-08',
          repeat: { kind: 'monthly', count: 12 },
        },
      },
    ]);
  });

  it('does not allow saving a bill without an amount', () => {
    const { fixture } = render();

    clickButton(fixture, 'Add bill');
    fill(fixture, 'input[name="description"]', 'Internet');
    fill(fixture, 'select[name="category"]', 'food');

    const save = element(fixture).querySelector<HTMLButtonElement>('[type="submit"]')!;
    expect(save.disabled).toBe(true);
  });

  it('edits a bill from its row and deletes it from the form', () => {
    const { fixture, bills } = render();

    clickButton(fixture, 'Edit Rent, −R$1,500.00');
    fill(fixture, 'input[name="amount"]', '1600');
    submit(fixture, 'Edit bill');
    clickButton(fixture, 'Edit Freelance job, +R$800.00');
    clickButton(fixture, 'Delete');

    expect([bills.saved[0].draft.amountCents, bills.deleted]).toEqual([160000, ['freelance']]);
  });

  it('pays a card invoice from a bank account', () => {
    const { fixture, bills, statements } = render();
    // Once the payment is stored the API no longer lists the invoice.
    bills.agendaToServe = { ...bills.agendaToServe, cardInvoices: [] };

    clickButton(fixture, 'Pay invoice: Credit card invoice');
    submit(fixture, 'Pay Credit card');

    expect(statements.savedPayments).toEqual([
      {
        id: 'id-1',
        cardId: 'credit-card',
        fromAccountId: 'checking-account',
        date: '2026-11-03',
        amountCents: 28640,
      },
    ]);
    expect(texts(fixture, 'app-bill-group .description')).not.toContain('Credit card invoice');
  });

  it('says so when there is nothing to pay or receive', () => {
    const bills = new FakeBillsGateway();
    bills.agendaToServe = { bills: [], cardInvoices: [] };
    const { fixture } = render(bills);

    expect(texts(fixture, '.empty')).toEqual([
      'Nothing to pay or receive. Add a bill to keep track of its due date.',
    ]);
  });

  it('offers to try again when the bills do not load', () => {
    const bills = new FakeBillsGateway();
    bills.failure = new Error('offline');
    const { fixture } = render(bills);

    expect(texts(fixture, 'app-load-failed')).toEqual([
      expect.stringContaining("Couldn't load your bills."),
    ]);
  });
});

/** A fund whose category exists among the sample categories, so the form can save it unchanged. */
const FOOD_FUND = { ...SAMPLE_SINKING_FUND, categoryId: 'food' };

function fundsGateway(): FakeSinkingFundsGateway {
  const funds = new FakeSinkingFundsGateway();
  funds.overviewToServe = { funds: [FOOD_FUND], totalMonthlyCents: 10000 };
  return funds;
}

function fillNewFund(fixture: ComponentFixture<Bills>): void {
  clickButton(fixture, 'New sinking fund');
  fill(fixture, 'input[name="description"]', 'Insurance');
  fill(fixture, 'select[name="category"]', 'food');
  fill(fixture, 'input[name="amount"]', '1200');
  fill(fixture, 'select[name="kind"]', 'fixedDate');
  fill(fixture, 'input[name="month"]', '3');
  fill(fixture, 'input[name="day"]', '10');
}

describe('To pay & receive page sinking funds', () => {
  it('lists the sinking funds below the bills', () => {
    const { fixture } = render(new FakeBillsGateway(), fundsGateway());

    expect(texts(fixture, 'app-sinking-fund-list .description')).toEqual(['IPVA']);
  });

  it('saves a new fund with a generated id and closes the form', () => {
    const { fixture, funds } = render(new FakeBillsGateway(), fundsGateway());

    fillNewFund(fixture);
    submit(fixture, 'New sinking fund');

    expect(funds.saved).toEqual([
      {
        id: 'id-1',
        today: '2026-11-03',
        draft: {
          description: 'Insurance',
          categoryId: 'food',
          amountCents: 120000,
          schedule: { kind: 'fixedDate', month: 3, day: 10 },
        },
      },
    ]);
    fixture.detectChanges();
    expect(element(fixture).querySelector('app-sinking-fund-form')).toBeNull();
  });

  it('keeps the form open and says so when the fund cannot be saved', () => {
    const funds = fundsGateway();
    const { fixture } = render(new FakeBillsGateway(), funds);

    fillNewFund(fixture);
    funds.failure = new Error('offline');
    submit(fixture, 'New sinking fund');

    expect(element(fixture).querySelector('app-sinking-fund-form')).not.toBeNull();
    expect(texts(fixture, '[role="alert"]')).toEqual(['Could not save the sinking fund.']);
  });

  it('edits a fund under its own id', () => {
    const { fixture, funds } = render(new FakeBillsGateway(), fundsGateway());

    clickButton(fixture, 'Edit IPVA');
    fill(fixture, 'input[name="amount"]', '1300');
    submit(fixture, 'Edit sinking fund');

    expect([funds.saved[0].id, funds.saved[0].draft.amountCents]).toEqual(['ipva', 130000]);
  });

  it('deletes a fund', () => {
    const { fixture, funds } = render(new FakeBillsGateway(), fundsGateway());

    clickButton(fixture, 'Delete sinking fund IPVA');

    expect(funds.deleted).toEqual(['ipva']);
  });

  it('reads the bills again once when the roll created some', () => {
    const funds = fundsGateway();
    funds.billsToRoll = [SAMPLE_BILLS[0]];
    const bills = new FakeBillsGateway();

    const { fixture } = render(bills, funds);
    fixture.detectChanges();

    expect(bills.askedDays).toEqual(['2026-11-03', '2026-11-03']);
  });

  it('does not read the bills again when the roll created none', () => {
    const bills = new FakeBillsGateway();

    render(bills, fundsGateway());

    expect(bills.askedDays).toEqual(['2026-11-03']);
  });

  it('offers to try again when the funds do not load', () => {
    const funds = fundsGateway();
    funds.failure = new Error('offline');
    const { fixture } = render(new FakeBillsGateway(), funds);

    expect(texts(fixture, 'app-load-failed')).toEqual([
      expect.stringContaining('Could not load the sinking funds.'),
    ]);
  });
});
