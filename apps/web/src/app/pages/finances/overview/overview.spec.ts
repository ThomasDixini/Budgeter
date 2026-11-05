import { ErrorHandler } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Clock } from '../../../core/calendar/clock';
import { FixedClock } from '../../../core/calendar/fixed-clock';
import { AccountStatementsGateway } from '../../../core/finances/account-statements-gateway';
import { BillsGateway } from '../../../core/finances/bills-gateway';
import { FakeAccountStatementsGateway } from '../../../core/finances/fake-account-statements-gateway';
import { FakeBillsGateway } from '../../../core/finances/fake-bills-gateway';
import {
  FakeFinanceReferencesGateway,
  FakeTransactionsGateway,
} from '../../../core/finances/fake-finances-gateways';
import {
  FinanceReferencesGateway,
  TransactionsGateway,
} from '../../../core/finances/transactions-gateway';
import { Overview } from './overview';

/** Tuesday, November 3, 2026. */
const NOW = new Date(2026, 10, 3, 9, 0);

/** Swallows the errors the page reports on purpose. */
class SilentErrorHandler extends ErrorHandler {
  override handleError(): void {
    // Reported failures are part of what these tests play out.
  }
}

function render(bills = new FakeBillsGateway()): ComponentFixture<Overview> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: BillsGateway, useValue: bills },
      { provide: AccountStatementsGateway, useValue: new FakeAccountStatementsGateway() },
      { provide: TransactionsGateway, useValue: new FakeTransactionsGateway() },
      { provide: FinanceReferencesGateway, useValue: new FakeFinanceReferencesGateway() },
      { provide: Clock, useValue: new FixedClock(NOW) },
      { provide: ErrorHandler, useClass: SilentErrorHandler },
    ],
  });
  const fixture = TestBed.createComponent(Overview);
  fixture.detectChanges();
  return fixture;
}

function texts(fixture: ComponentFixture<Overview>, selector: string): string[] {
  return [...(fixture.nativeElement as HTMLElement).querySelectorAll(selector)].map(
    (node) => node.textContent?.replaceAll(/\s+/g, ' ').trim() ?? '',
  );
}

describe('Finances Overview page', () => {
  it('shows balances, open invoices and this month so far', () => {
    const fixture = render();

    expect(texts(fixture, '.stat .value')).toEqual(['R$10,028.60', 'R$286.40', 'R$0.00', 'R$0.00']);
  });

  it('draws six months of received against spent, October holding the sample month', () => {
    const fixture = render();

    const labels = texts(fixture, '.chart .month');
    const columns = (fixture.nativeElement as HTMLElement).querySelectorAll('.chart .column');
    const october = columns[labels.indexOf('Oct')].getAttribute('aria-label');
    expect([labels.length, october]).toEqual([6, 'Oct: received R$9,500.00, spent R$345.30']);
  });

  it('lists what is due next, overdue first, leaving out what is paid', () => {
    const fixture = render();

    expect(texts(fixture, '[aria-label="Upcoming"] .description')).toEqual([
      'Rent',
      'Freelance job',
      'Credit card invoice',
      'Course',
    ]);
  });

  it('says when nothing was spent this month and nothing is due', () => {
    const bills = new FakeBillsGateway();
    bills.agendaToServe = { bills: [], cardInvoices: [] };
    const fixture = render(bills);

    expect(texts(fixture, '.empty')).toEqual([
      'Nothing spent this month yet.',
      'Nothing to pay or receive.',
    ]);
  });

  it('offers to try again when the overview does not load', () => {
    const bills = new FakeBillsGateway();
    bills.failure = new Error('offline');
    const fixture = render(bills);

    expect(texts(fixture, 'app-load-failed')).toEqual([
      expect.stringContaining("Couldn't load your overview."),
    ]);
  });
});
