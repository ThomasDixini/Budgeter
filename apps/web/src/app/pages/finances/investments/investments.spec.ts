import { ErrorHandler, LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Clock } from '../../../core/calendar/clock';
import { FixedClock } from '../../../core/calendar/fixed-clock';
import { FakeInvestmentsGateway } from '../../../core/finances/fake-investments-gateway';
import { InvestmentsGateway } from '../../../core/finances/investments-gateway';
import { IdGenerator } from '../../../core/ids/id-generator';
import { SequentialIdGenerator } from '../../../core/ids/sequential-id-generator';
import { Investments } from './investments';

/** Tuesday, November 3, 2026. */
const NOW = new Date(2026, 10, 3, 9, 0);

/** Swallows the errors the page reports on purpose. */
class SilentErrorHandler extends ErrorHandler {
  override handleError(): void {
    // Reported failures are part of what these tests play out.
  }
}

/** Lets the store's promises settle (they are not tracked by the fixture), then redraws. */
async function flush(fixture: ComponentFixture<Investments>): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();
}

async function render(
  gateway = new FakeInvestmentsGateway(),
  locale = 'en-US',
): Promise<{ fixture: ComponentFixture<Investments>; gateway: FakeInvestmentsGateway }> {
  TestBed.configureTestingModule({
    providers: [
      { provide: InvestmentsGateway, useValue: gateway },
      { provide: LOCALE_ID, useValue: locale },
      { provide: Clock, useValue: new FixedClock(NOW) },
      { provide: IdGenerator, useValue: new SequentialIdGenerator() },
      { provide: ErrorHandler, useClass: SilentErrorHandler },
    ],
  });
  const fixture = TestBed.createComponent(Investments);
  fixture.detectChanges();
  await flush(fixture);
  return { fixture, gateway };
}

function texts(fixture: ComponentFixture<Investments>, selector: string): string[] {
  return [...(fixture.nativeElement as HTMLElement).querySelectorAll(selector)].map(
    (node) => node.textContent?.replaceAll(/\s+/g, ' ').trim() ?? '',
  );
}

async function clickButton(fixture: ComponentFixture<Investments>, label: string): Promise<void> {
  const buttons = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')];
  buttons
    .find(
      (button) =>
        button.getAttribute('aria-label') === label || button.textContent?.trim() === label,
    )!
    .click();
  fixture.detectChanges();
  await flush(fixture);
}

function fill(fixture: ComponentFixture<Investments>, selector: string, value: string): void {
  const field = (fixture.nativeElement as HTMLElement).querySelector<
    HTMLInputElement | HTMLSelectElement
  >(selector)!;
  field.value = value;
  field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input'));
  field.dispatchEvent(new Event('change'));
  fixture.detectChanges();
}

async function submit(fixture: ComponentFixture<Investments>, formLabel: string): Promise<void> {
  (fixture.nativeElement as HTMLElement)
    .querySelector<HTMLButtonElement>(`form[aria-label="${formLabel}"] [type="submit"]`)!
    .click();
  fixture.detectChanges();
  await flush(fixture);
}

function hasForm(fixture: ComponentFixture<Investments>, formLabel: string): boolean {
  return (
    (fixture.nativeElement as HTMLElement).querySelector(`form[aria-label="${formLabel}"]`) !== null
  );
}

describe('Investments page', () => {
  it('sums the portfolio up in the heading and the stats', async () => {
    const { fixture } = await render();

    expect(texts(fixture, 'app-page-heading .description')).toEqual(['Portfolio: R$1,310.00']);
    expect([
      texts(fixture, '.stat .label'),
      texts(fixture, '.stat .value'),
      texts(fixture, '.stat .note'),
    ]).toEqual([
      ['Current value · whole portfolio', 'Invested', 'Return', 'Proventos · 12 months'],
      ['R$1,310.00', 'R$1,110.00', '+18.02%', 'R$15.00'],
      [
        '+R$200.00 (+18.02%) since purchase',
        'Sum at cost',
        'CDI on the same money: +0.36%',
        'Dividends and yields',
      ],
    ]);
  });

  it('says how far the CDI goes and what is valued at cost', async () => {
    const { fixture } = await render();

    expect(texts(fixture, '.cdi-note')).toEqual([
      'CDI rates through Nov 3. 1 without a price are valued at cost.',
    ]);
  });

  it('says so when the CDI could not be loaded', async () => {
    const gateway = new FakeInvestmentsGateway();
    const { performance, ...rest } = gateway.portfolioToServe;
    gateway.portfolioToServe = {
      ...rest,
      performance: { ...performance!, cdiThrough: undefined, cdiGainCents: 0, cdiPercent: 0 },
    };
    const { fixture } = await render(gateway);

    expect(texts(fixture, '.cdi-note')[0]).toContain('CDI rates could not be loaded.');
  });

  it('says in Portuguese that an asset has no price yet and is valued at cost', async () => {
    const { fixture } = await render(new FakeInvestmentsGateway(), 'pt-BR');

    const cells = texts(fixture, '.assets tbody .number');

    expect(cells).toContain('Sem preço ainda');
    expect(cells).toContain('Pelo custo');
  });

  it('lists each asset with its units, prices, value and return, biggest first', async () => {
    const { fixture } = await render();

    expect([
      texts(fixture, '.assets .asset .name'),
      texts(fixture, '.assets tbody .number'),
    ]).toEqual([
      ['PETR4', 'XPML11'],
      [
        '100',
        'R$10.00',
        'R$12.00 Nov 2',
        'R$1,000.00',
        'R$1,200.00',
        '+R$200.00 (+20.00%)',
        '10',
        'R$11.00',
        'No price yet',
        'R$110.00',
        'At cost',
        '',
      ],
    ]);
  });

  it('narrows the cards to one kind and the table to its assets', async () => {
    const { fixture } = await render();

    await clickButton(fixture, 'Real estate fund');

    expect([texts(fixture, '.stat .value')[0], texts(fixture, '.assets .asset .name')]).toEqual([
      'R$110.00',
      ['XPML11'],
    ]);
  });

  it('narrows the cards to one asset picked in the table, and back to all', async () => {
    const { fixture } = await render();

    await clickButton(fixture, 'Show only PETR4');
    const picked = texts(fixture, '.stat .value')[0];
    await clickButton(fixture, 'Show only PETR4');

    expect([picked, texts(fixture, '.stat .value')[0]]).toEqual(['R$1,200.00', 'R$1,310.00']);
  });

  it('charts proventos by month over the period and leaves the history charts empty', async () => {
    const { fixture } = await render();

    expect([
      texts(fixture, 'app-bar-chart .title'),
      texts(fixture, 'app-bar-chart .note'),
      texts(fixture, '.empty.ui-muted'),
      (fixture.nativeElement as HTMLElement).querySelectorAll('app-bar-chart .bar').length,
    ]).toEqual([
      ['Return per month', 'Proventos received'],
      ['Average R$1.25 per month'],
      ['No history yet.', 'No history yet.'],
      12,
    ]);
  });

  it('shortens the period of the charts', async () => {
    const { fixture } = await render();

    await clickButton(fixture, '3M');

    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll('app-bar-chart .bar').length,
    ).toBe(3);
  });

  it('covers a period of days picked by the person, in the cards and the charts', async () => {
    const { fixture } = await render();
    await clickButton(fixture, 'Custom');

    fill(fixture, 'input[name="from"]', '2026-10-29');
    const afterTheDividend = [texts(fixture, '.stat .label')[3], texts(fixture, '.stat .value')[3]];
    fill(fixture, 'input[name="from"]', '2026-10-01');

    expect([
      afterTheDividend,
      texts(fixture, '.stat .value')[3],
      (fixture.nativeElement as HTMLElement).querySelectorAll('app-bar-chart .bar').length,
    ]).toEqual([['Proventos · Oct 29, 2026 – Nov 3, 2026', 'R$0.00'], 'R$15.00', 2]);
  });

  it('says why a period is refused and keeps the last good one', async () => {
    const { fixture } = await render();
    await clickButton(fixture, 'Custom');

    fill(fixture, 'input[name="from"]', '2027-01-01');

    expect([texts(fixture, 'app-period-filter .error'), texts(fixture, '.stat .label')[3]]).toEqual(
      [
        ['Pick a start day that is not after the end, within 10 years.'],
        'Proventos · Dec 1, 2025 – Nov 3, 2026',
      ],
    );
  });

  it('shows the return of the period, not since purchase, once month-end figures cover it', async () => {
    const gateway = new FakeInvestmentsGateway();
    gateway.portfolioToServe = {
      ...gateway.portfolioToServe,
      history: [
        { month: '2026-09', valueCents: 1, appliedCents: 1, returnPercent: 11, cdiPercent: 1 },
        { month: '2026-10', valueCents: 1, appliedCents: 1, returnPercent: 30, cdiPercent: 2 },
      ],
    };
    const { fixture } = await render(gateway);

    expect([texts(fixture, '.stat .value')[2], texts(fixture, '.stat .note')[2]]).toEqual([
      '+17.12%',
      'CDI in the period: +0.99%',
    ]);
  });

  it('shows the figures of the month picked on the gains chart, and clears them', async () => {
    const gateway = new FakeInvestmentsGateway();
    gateway.portfolioToServe = {
      ...gateway.portfolioToServe,
      history: [
        {
          month: '2026-09',
          valueCents: 100000,
          appliedCents: 90000,
          returnPercent: 11,
          cdiPercent: 1,
        },
        {
          month: '2026-10',
          valueCents: 130000,
          appliedCents: 100000,
          returnPercent: 30,
          cdiPercent: 2,
        },
      ],
    };
    const { fixture } = await render(gateway);
    const hits = (): NodeListOf<SVGRectElement> =>
      (fixture.nativeElement as HTMLElement).querySelectorAll<SVGRectElement>('.hit');

    hits()[hits().length - 2].dispatchEvent(new Event('click'));
    fixture.detectChanges();
    const picked = texts(fixture, '.month-detail div');
    const title = texts(fixture, '.month-title');
    hits()[hits().length - 2].dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect([title, picked, texts(fixture, '.month-hint')]).toEqual([
      ['October 2026'],
      ['Gain +R$200.00', 'Value at month endR$1,300.00', 'AppliedR$1,000.00'],
      ['Click a bar to see that month. Click it again to clear.'],
    ]);
  });

  it('splits the portfolio between kinds of investment', async () => {
    const { fixture } = await render();

    expect(texts(fixture, 'app-portfolio-distribution .legend li')).toEqual([
      'Stock 92% · R$1,200.00',
      'Real estate fund 8% · R$110.00',
    ]);
  });

  it('lists purchases and proventos newest first, signed', async () => {
    const { fixture } = await render();

    expect([texts(fixture, '.movement .name'), texts(fixture, '.movement .amount')]).toEqual([
      ['Oct 28 · PETR4 · Dividend', 'Oct 20 · XPML11 · Buy 10', 'Oct 5 · PETR4 · Buy 100'],
      ['+R$15.00', '−R$110.00', '−R$1,000.00'],
    ]);
  });

  it('records a purchase starting from the latest price, then closes the form', async () => {
    const { fixture, gateway } = await render();

    await clickButton(fixture, 'Trade PETR4');
    fill(fixture, 'input[name="quantity"]', '10');
    await submit(fixture, 'Trade PETR4');

    expect(gateway.savedTrades).toEqual([
      {
        id: 'id-1',
        draft: {
          investmentId: 'petr4',
          date: '2026-11-03',
          kind: 'buy',
          quantityThousandths: 10000,
          unitPriceCents: 1200,
        },
      },
    ]);
    expect([hasForm(fixture, 'Trade PETR4'), gateway.askedDays.length]).toEqual([false, 2]);
  });

  it('shows what the trade comes to as it is typed', async () => {
    const { fixture } = await render();

    await clickButton(fixture, 'Trade PETR4');
    fill(fixture, 'input[name="quantity"]', '2,5');

    expect(texts(fixture, '.total')).toEqual(['Total R$30.00']);
  });

  it('keeps the form open when the API refuses the trade', async () => {
    const { fixture, gateway } = await render();
    await clickButton(fixture, 'Trade PETR4');
    fill(fixture, 'input[name="quantity"]', '500');
    await clickButton(fixture, 'Sell');
    gateway.failure = new Error('Expected a sale of at most 100 units');

    await submit(fixture, 'Trade PETR4');

    expect(hasForm(fixture, 'Trade PETR4')).toBe(true);
  });

  it('records a provento', async () => {
    const { fixture, gateway } = await render();

    await clickButton(fixture, 'Add income to PETR4');
    fill(fixture, 'input[name="amount"]', '12,50');
    await submit(fixture, 'Income from PETR4');

    expect(gateway.savedIncomes).toEqual([
      {
        id: 'id-1',
        draft: { investmentId: 'petr4', date: '2026-11-03', kind: 'dividend', amountCents: 1250 },
      },
    ]);
  });

  it('adds an investment without a price', async () => {
    const { fixture, gateway } = await render();

    await clickButton(fixture, 'Add investment');
    fill(fixture, 'input[name="name"]', 'ITSA4');
    await submit(fixture, 'New investment');

    expect(gateway.savedInvestments).toEqual([
      { id: 'id-1', draft: { name: 'ITSA4', kind: 'stock', price: undefined } },
    ]);
  });

  it('dates a changed price today and keeps the day of an unchanged one', async () => {
    const { fixture, gateway } = await render();

    await clickButton(fixture, 'Edit PETR4');
    await submit(fixture, 'Edit investment');
    await clickButton(fixture, 'Edit PETR4');
    fill(fixture, 'input[name="price"]', '12,50');
    await submit(fixture, 'Edit investment');

    expect(gateway.savedInvestments.map((request) => request.draft.price)).toEqual([
      { cents: 1200, on: '2026-11-02' },
      { cents: 1250, on: '2026-11-03' },
    ]);
  });

  it('deletes an investment from its form and a movement from the list', async () => {
    const { fixture, gateway } = await render();

    await clickButton(fixture, 'Delete Buy 100 of PETR4');
    await clickButton(fixture, 'Edit XPML11');
    await clickButton(fixture, 'Delete');

    expect([gateway.deletedTrades, gateway.deletedInvestments]).toEqual([
      ['buy-petr4'],
      ['xpml11'],
    ]);
  });

  it('says so when there is nothing yet', async () => {
    const gateway = new FakeInvestmentsGateway();
    gateway.portfolioToServe = {
      lines: [],
      totals: {
        costCents: 0,
        valueCents: 0,
        unpricedCount: 0,
        incomeCents: 0,
        incomeLast12MonthsCents: 0,
      },
      trades: [],
      incomes: [],
    };
    const { fixture } = await render(gateway);

    expect(
      texts(fixture, '[aria-label="Holdings"] .empty, [aria-label="Movements"] .empty'),
    ).toEqual([
      'No investments yet. Add one, then record your purchases to follow it here.',
      'Nothing recorded yet.',
    ]);
  });

  it('offers to try again when the portfolio does not load', async () => {
    const gateway = new FakeInvestmentsGateway();
    gateway.failure = new Error('offline');
    const { fixture } = await render(gateway);

    expect(texts(fixture, 'app-load-failed')).toEqual([
      expect.stringContaining("Couldn't load your investments."),
    ]);
  });
});
