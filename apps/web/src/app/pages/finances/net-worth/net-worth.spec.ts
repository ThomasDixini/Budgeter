import { ErrorHandler, computed } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Clock } from '../../../core/calendar/clock';
import { FixedClock } from '../../../core/calendar/fixed-clock';
import { AccountStatementsGateway } from '../../../core/finances/account-statements-gateway';
import { FakeAccountStatementsGateway } from '../../../core/finances/fake-account-statements-gateway';
import { FakeFinanceReferencesGateway } from '../../../core/finances/fake-finances-gateways';
import {
  FakeInvestmentsGateway,
  SAMPLE_PORTFOLIO,
} from '../../../core/finances/fake-investments-gateway';
import { InvestmentsGateway } from '../../../core/finances/investments-gateway';
import { FinanceReferencesGateway } from '../../../core/finances/transactions-gateway';
import { NetWorthStore } from '../../../core/finances/net-worth-store';
import { NetWorthPoint } from '../../../core/finances/net-worth';
import { NetWorth } from './net-worth';

/** Saturday, October 31, 2026, the day the sample statements are from. */
const HALLOWEEN = new Date(2026, 9, 31, 20, 0);

/** Swallows the errors the page reports on purpose. */
class SilentErrorHandler extends ErrorHandler {
  override handleError(): void {
    // Reported failures are part of what these tests play out.
  }
}

/** A store that already knows three month-ends, since nothing keeps them yet. */
class StoreWithHistory extends NetWorthStore {
  override readonly history = computed<readonly NetWorthPoint[]>(() => [
    { month: '2026-08', cents: 1_000_000 },
    { month: '2026-09', cents: 1_100_000 },
    { month: '2026-10', cents: 1_050_000 },
  ]);
}

function render(investments = new FakeInvestmentsGateway()): ComponentFixture<NetWorth> {
  TestBed.configureTestingModule({
    providers: [
      { provide: AccountStatementsGateway, useValue: new FakeAccountStatementsGateway() },
      { provide: InvestmentsGateway, useValue: investments },
      { provide: FinanceReferencesGateway, useValue: new FakeFinanceReferencesGateway() },
      { provide: Clock, useValue: new FixedClock(HALLOWEEN) },
      { provide: ErrorHandler, useClass: SilentErrorHandler },
    ],
  });
  const fixture = TestBed.createComponent(NetWorth);
  fixture.detectChanges();
  return fixture;
}

function texts(fixture: ComponentFixture<NetWorth>, selector: string): string[] {
  return [...(fixture.nativeElement as HTMLElement).querySelectorAll(selector)].map(
    (node) => node.textContent?.replaceAll(/\s+/g, ' ').trim() ?? '',
  );
}

describe('Net worth page', () => {
  it('shows the net worth of today and leaves the history figures blank', () => {
    const fixture = render();

    expect([texts(fixture, '.stat .label'), texts(fixture, '.stat .value')]).toEqual([
      ['Net worth today', 'Growth in period', 'Average per month', 'Best month'],
      ['R$11,052.20', '—', '—', '—'],
    ]);
  });

  it('adds the balances and investments and takes away what the cards owe', () => {
    const fixture = render();

    expect(texts(fixture, '[aria-label="What it is made of"] .row')).toEqual([
      'Cash in accountsR$10,028.60',
      'InvestmentsR$1,310.00',
      'Open invoices−R$286.40',
      'Net worthR$11,052.20',
    ]);
  });

  it('says there is no history yet, in the chart and in the table', () => {
    const fixture = render();

    expect([texts(fixture, 'app-line-chart .empty'), texts(fixture, '.history-empty')]).toEqual([
      ['No history yet.'],
      ['No history yet.'],
    ]);
  });

  it('changes the period', () => {
    const fixture = render();

    const button = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
      (candidate) => candidate.textContent?.trim() === '3 months',
    )!;
    button.click();
    fixture.detectChanges();

    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('lists each account, investment and card behind the totals', () => {
    const fixture = render();

    expect([
      texts(fixture, '[aria-label="Bank accounts"] .row'),
      texts(fixture, '[aria-label="Investments"] .row'),
      texts(fixture, '[aria-label="Credit cards"] .row'),
    ]).toEqual([
      ['Checking accountR$10,028.60'],
      ['PETR4R$1,200.00', 'XPML11R$110.00'],
      ['Credit cardR$286.40'],
    ]);
  });

  it('says what is valued at cost for lack of a price', () => {
    const fixture = render();

    expect(texts(fixture, '.note')).toEqual(['1 without a price is valued at cost.']);
  });

  it('counts a closed position and an empty portfolio as nothing', () => {
    const investments = new FakeInvestmentsGateway();
    investments.portfolioToServe = {
      ...SAMPLE_PORTFOLIO,
      lines: [],
      totals: { ...SAMPLE_PORTFOLIO.totals, unpricedCount: 0 },
    };
    const fixture = render(investments);

    expect([
      texts(fixture, '.stat .value')[0],
      texts(fixture, '[aria-label="Investments"] .empty'),
    ]).toEqual(['R$9,742.20', ['Nothing invested yet.']]);
  });

  it('lets the person pick the days of a period', () => {
    const fixture = render();
    const custom = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
      (candidate) => candidate.textContent?.trim() === 'Custom',
    )!;

    custom.click();
    fixture.detectChanges();

    expect([
      custom.getAttribute('aria-pressed'),
      (fixture.nativeElement as HTMLElement).querySelectorAll('input[type="date"]').length,
    ]).toEqual(['true', 2]);
  });

  it('offers to try again when the net worth does not load', () => {
    const investments = new FakeInvestmentsGateway();
    investments.failure = new Error('offline');
    const fixture = render(investments);

    expect(texts(fixture, 'app-load-failed')).toEqual([
      expect.stringContaining("Couldn't load your net worth."),
    ]);
  });

  it('shows the growth, the best month and one table row per month when there is history', () => {
    TestBed.overrideComponent(NetWorth, {
      set: { providers: [{ provide: NetWorthStore, useClass: StoreWithHistory }] },
    });
    const fixture = render();

    expect(texts(fixture, '.stat .value')).toEqual([
      expect.any(String),
      expect.stringContaining('500'),
      expect.stringContaining('250'),
      expect.stringContaining('1,000'),
    ]);
    expect(texts(fixture, '.history-empty')).toEqual([]);
    expect(texts(fixture, 'table tbody tr')).toHaveLength(2);
  });
});
