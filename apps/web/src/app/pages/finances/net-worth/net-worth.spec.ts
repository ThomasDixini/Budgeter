import { ErrorHandler } from '@angular/core';
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
import { NetWorth } from './net-worth';

/** Saturday, October 31, 2026, the day the sample statements are from. */
const HALLOWEEN = new Date(2026, 9, 31, 20, 0);

/** Swallows the errors the page reports on purpose. */
class SilentErrorHandler extends ErrorHandler {
  override handleError(): void {
    // Reported failures are part of what these tests play out.
  }
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
  it('adds the balances and investments and takes away what the cards owe', () => {
    const fixture = render();

    expect([texts(fixture, '.stat .label'), texts(fixture, '.stat .value')]).toEqual([
      ['Net worth', 'Assets', 'Owed on cards'],
      ['R$11,052.20', 'R$11,338.60', 'R$286.40'],
    ]);
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

  it('splits the assets between bank accounts and investments', () => {
    const fixture = render();

    expect(texts(fixture, '.legend')).toEqual(['Bank accounts 88%Investments 12%']);
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

    expect([texts(fixture, '.stat .value')[0], texts(fixture, '.empty')]).toEqual([
      'R$9,742.20',
      ['Nothing invested yet.'],
    ]);
  });

  it('offers to try again when the net worth does not load', () => {
    const investments = new FakeInvestmentsGateway();
    investments.failure = new Error('offline');
    const fixture = render(investments);

    expect(texts(fixture, 'app-load-failed')).toEqual([
      expect.stringContaining("Couldn't load your net worth."),
    ]);
  });
});
