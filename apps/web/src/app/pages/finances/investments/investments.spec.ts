import { ErrorHandler } from '@angular/core';
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
): Promise<{ fixture: ComponentFixture<Investments>; gateway: FakeInvestmentsGateway }> {
  TestBed.configureTestingModule({
    providers: [
      { provide: InvestmentsGateway, useValue: gateway },
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
      ['Current value', 'Invested', 'Gain', 'CDI on the same money', 'Proventos · 12 months'],
      ['R$1,310.00', 'R$1,110.00', '+R$215.00', '+R$4.00', 'R$15.00'],
      ['+19.37%', '+0.36%'],
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

  it('lists each holding with its units, price, value and gain', async () => {
    const { fixture } = await render();

    expect(texts(fixture, '[aria-label="Holdings"] .holding .detail')).toEqual([
      '100 units · average R$10.00',
      'R$12.00 · Nov 2',
      '+R$200.00 (+20.00%)',
      '10 units · average R$11.00',
      'No price yet',
      '',
    ]);
    expect(texts(fixture, '.value-text')).toEqual(['R$1,200.00', 'At cost']);
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

    expect(texts(fixture, '.empty')).toEqual([
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
