import { ErrorHandler } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Clock } from '../../../core/calendar/clock';
import { Account, FinanceCategory } from '../../../core/finances/finance-references';
import { FixedClock } from '../../../core/calendar/fixed-clock';
import {
  FakeFinanceReferencesGateway,
  FakeTransactionsGateway,
} from '../../../core/finances/fake-finances-gateways';
import {
  FinanceReferencesGateway,
  TransactionsGateway,
} from '../../../core/finances/transactions-gateway';
import { IdGenerator } from '../../../core/ids/id-generator';
import { SequentialIdGenerator } from '../../../core/ids/sequential-id-generator';
import { Transactions } from './transactions';

/** Saturday, October 31, 2026. */
const HALLOWEEN = new Date(2026, 9, 31, 20, 0);

/** Swallows the errors the page reports on purpose. */
class SilentErrorHandler extends ErrorHandler {
  override handleError(): void {
    // Reported failures are part of what these tests play out.
  }
}

/** An account that has not added a bank account or a category yet. */
class EmptyReferencesGateway extends FakeFinanceReferencesGateway {
  override categories(): Observable<readonly FinanceCategory[]> {
    return of([]);
  }

  override accounts(): Observable<readonly Account[]> {
    return of([]);
  }
}

function render(
  gateway = new FakeTransactionsGateway(),
  references: FinanceReferencesGateway = new FakeFinanceReferencesGateway(),
): ComponentFixture<Transactions> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: TransactionsGateway, useValue: gateway },
      { provide: FinanceReferencesGateway, useValue: references },
      { provide: Clock, useValue: new FixedClock(HALLOWEEN) },
      { provide: IdGenerator, useValue: new SequentialIdGenerator() },
      { provide: ErrorHandler, useClass: SilentErrorHandler },
    ],
  });
  const fixture = TestBed.createComponent(Transactions);
  fixture.detectChanges();
  return fixture;
}

function element(fixture: ComponentFixture<Transactions>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function texts(fixture: ComponentFixture<Transactions>, selector: string): string[] {
  return [...element(fixture).querySelectorAll(selector)].map(
    (node) => node.textContent?.replaceAll(/\s+/g, ' ').trim() ?? '',
  );
}

function click(fixture: ComponentFixture<Transactions>, selector: string, label: string): void {
  const buttons = [...element(fixture).querySelectorAll<HTMLButtonElement>(selector)];
  buttons.find((button) => button.textContent?.includes(label))!.click();
  fixture.detectChanges();
}

function clickLabelled(fixture: ComponentFixture<Transactions>, label: string): void {
  element(fixture).querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click();
  fixture.detectChanges();
}

function search(fixture: ComponentFixture<Transactions>, query: string): void {
  const field = element(fixture).querySelector<HTMLInputElement>('input[type="search"]')!;
  field.value = query;
  field.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

describe('Transactions page', () => {
  it('tells where to start when there is no account or category yet, and records nothing', () => {
    const fixture = render(new FakeTransactionsGateway(), new EmptyReferencesGateway());

    const hint = element(fixture).querySelector('.setup-hint');
    const links = Array.from(hint?.querySelectorAll('a') ?? [], (link) =>
      link.getAttribute('href'),
    );
    const newTransaction = element(fixture).querySelector<HTMLButtonElement>('.ui-button-primary');

    expect(links).toEqual(['/finances/accounts', '/finances/income-split']);
    expect(newTransaction?.disabled).toBe(true);
  });

  it('shows no start hint once there is an account and a category', () => {
    const fixture = render();

    expect(element(fixture).querySelector('.setup-hint')).toBeNull();
  });

  it('heads the page with the month shown', () => {
    const fixture = render();

    expect(texts(fixture, '.ui-eyebrow')).toEqual(['Finances · October 2026']);
  });

  it('sums up the month in the cards', () => {
    const fixture = render();

    expect(texts(fixture, 'app-month-summary .value')).toEqual([
      'R$9,500.00',
      'R$345.30',
      '+R$9,154.70',
      '3',
    ]);
  });

  it('lists the transactions by day, newest first, with names and signed amounts', () => {
    const fixture = render();

    expect(texts(fixture, '.day-header span')).toEqual([
      'Saturday, October 31',
      '−R$286.40',
      'Tuesday, October 27',
      '−R$58.90',
      'Monday, October 5',
      '+R$9,500.00',
    ]);
    expect(element(fixture).querySelector('.row')?.getAttribute('aria-label')).toBe(
      'Edit Groceries, Credit card, Food, −R$286.40',
    );
  });

  it('narrows the list and the cards with the filters', () => {
    const fixture = render();

    click(fixture, 'app-filters-bar .ui-chip', 'Credit card');

    expect([texts(fixture, '.description'), texts(fixture, 'app-month-summary .value')[3]]).toEqual(
      [['Groceries'], '1'],
    );
  });

  it('says when the filters match nothing', () => {
    const fixture = render();

    search(fixture, 'travel');

    expect(texts(fixture, '.empty')).toEqual(['No transactions match these filters.']);
  });

  it('says when a month has no transactions yet', () => {
    const fixture = render();

    clickLabelled(fixture, 'Next month');

    expect([texts(fixture, '.ui-eyebrow')[0], texts(fixture, '.empty')]).toEqual([
      'Finances · November 2026',
      ['No transactions in November 2026 yet.'],
    ]);
  });

  it('records a transaction from the form', () => {
    const gateway = new FakeTransactionsGateway();
    const fixture = render(gateway);
    click(fixture, 'button', 'New transaction');
    fillForm(fixture);

    click(fixture, 'button[type="submit"]', 'Add transaction');

    expect([
      texts(fixture, '.description')[0],
      gateway.saved.length,
      texts(fixture, 'form'),
    ]).toEqual(['Fuel', 1, []]);
  });

  it('says where a transaction dated in another month went', () => {
    const fixture = render();
    click(fixture, 'button', 'New transaction');
    fillForm(fixture, '2026-11-02');

    click(fixture, 'button[type="submit"]', 'Add transaction');

    expect(texts(fixture, '[role="status"]')).toEqual(['Saved to November 2026.']);
  });

  it('deletes the transaction opened from its row', () => {
    const gateway = new FakeTransactionsGateway();
    const fixture = render(gateway);
    click(fixture, '.row', 'Groceries');

    click(fixture, 'form button', 'Delete');

    expect([gateway.deleted, texts(fixture, '.description')]).toEqual([
      ['groceries'],
      ['Farmácia', 'Salary'],
    ]);
  });

  it('offers to try again when the month could not be loaded', () => {
    const gateway = new FakeTransactionsGateway();
    gateway.failure = new Error('offline');
    const fixture = render(gateway);

    gateway.failure = undefined;
    click(fixture, 'app-load-failed button', 'Try again');

    expect([texts(fixture, 'app-load-failed'), texts(fixture, '.description').length]).toEqual([
      [],
      3,
    ]);
  });
});

function fillForm(fixture: ComponentFixture<Transactions>, date = '2026-10-31'): void {
  const form = element(fixture).querySelector('form')!;
  setField(form.querySelector('input[name="amount"]')!, '210', 'input');
  setField(form.querySelector('input[maxlength="80"]')!, 'Fuel', 'input');
  setField(form.querySelector('select')!, 'food', 'change');
  setField(form.querySelector('input[type="date"]')!, date, 'change');
  fixture.detectChanges();
}

function setField(field: HTMLInputElement | HTMLSelectElement, value: string, event: string): void {
  field.value = value;
  field.dispatchEvent(new Event(event));
}
