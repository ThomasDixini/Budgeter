import { ComponentFixture, TestBed } from '@angular/core/testing';
import { formatMoney } from '../../../../core/finances/money';
import { SinkingFund } from '../../../../core/finances/sinking-funds';
import { SinkingFundList } from './sinking-fund-list';

const LOCALE = 'en-US';

function fundOf(overrides: Partial<SinkingFund> = {}): SinkingFund {
  return {
    id: 'fund-1',
    description: 'Vehicle tax',
    categoryId: 'category-1',
    amountCents: 120_000,
    schedule: {
      kind: 'fixedDate',
      intervalMonths: 12,
      month: 1,
      day: 20,
      nextDueDate: '2027-01-20',
    },
    savedCents: 0,
    monthlyCents: 20_000,
    cycleStart: '2026-07-20',
    ...overrides,
  };
}

function render(funds: readonly SinkingFund[], total = 0): ComponentFixture<SinkingFundList> {
  const fixture = TestBed.createComponent(SinkingFundList);
  fixture.componentRef.setInput('funds', funds);
  fixture.componentRef.setInput('totalMonthlyCents', total);
  fixture.componentRef.setInput('categories', [{ id: 'category-1', name: 'Taxes' }]);
  fixture.detectChanges();
  return fixture;
}

function root(fixture: ComponentFixture<SinkingFundList>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function text(fixture: ComponentFixture<SinkingFundList>): string {
  return root(fixture).textContent?.replaceAll(/\s+/g, ' ') ?? '';
}

function progressValue(fixture: ComponentFixture<SinkingFundList>): string | null {
  return root(fixture).querySelector('[role="progressbar"]')!.getAttribute('aria-valuenow');
}

function button(fixture: ComponentFixture<SinkingFundList>, label: string): HTMLButtonElement {
  return [...root(fixture).querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) =>
      candidate.getAttribute('aria-label') === label || candidate.textContent?.trim() === label,
  )!;
}

describe('SinkingFundList', () => {
  it('shows the empty state and no total when there are no funds', () => {
    const fixture = render([]);

    expect(text(fixture)).toContain('No sinking funds yet.');
    expect(text(fixture)).not.toContain('Total to set aside');
    expect(root(fixture).querySelector('li')).toBeNull();
  });

  it('shows description, category, due text, saved text and monthly text', () => {
    const fixture = render([fundOf({ savedCents: 60_000 })], 20_000);

    const content = text(fixture);
    expect(content).toContain('Vehicle tax');
    expect(content).toContain('Taxes');
    expect(content).toContain('Falls due');
    expect(content).toContain(
      `Saved so far ${formatMoney(60_000, LOCALE)} of ${formatMoney(120_000, LOCALE)}`,
    );
    expect(content).toContain(`Set aside ${formatMoney(20_000, LOCALE)} per month`);
  });

  it('exposes progress for 0, 50 and 100 percent', () => {
    const cases: readonly [number, string][] = [
      [0, '0'],
      [60_000, '50'],
      [120_000, '100'],
    ];

    for (const [savedCents, expected] of cases) {
      const fixture = render([fundOf({ savedCents })]);
      expect(progressValue(fixture)).toBe(expected);
      expect(text(fixture)).toContain(`${expected}%`);
    }
  });

  it('caps progress at 100 when more than the cost is saved', () => {
    const fixture = render([fundOf({ savedCents: 150_000 })]);

    expect(progressValue(fixture)).toBe('100');
  });

  it('omits the category when it is unknown', () => {
    const fixture = render([fundOf({ categoryId: 'missing' })]);

    expect(text(fixture)).toContain('Vehicle tax');
    expect(text(fixture)).not.toContain('·  Falls');
    expect(text(fixture)).toContain('Falls due');
  });

  it('keeps the full description in the title of a long one', () => {
    const description = 'A very long sinking fund description '.repeat(6).trim();
    const fixture = render([fundOf({ description })]);

    expect(root(fixture).querySelector('.description')!.getAttribute('title')).toBe(description);
  });

  it('shows the monthly total footer', () => {
    const fixture = render([fundOf()], 35_000);

    expect(text(fixture)).toContain(`Total to set aside per month: ${formatMoney(35_000, LOCALE)}`);
  });

  it('emits add, edit and remove', () => {
    const fund = fundOf();
    const fixture = render([fund]);
    let added = 0;
    const edited: SinkingFund[] = [];
    const removed: SinkingFund[] = [];
    fixture.componentInstance.add.subscribe(() => added++);
    fixture.componentInstance.edit.subscribe((value) => edited.push(value));
    fixture.componentInstance.remove.subscribe((value) => removed.push(value));

    button(fixture, 'New sinking fund').click();
    button(fixture, 'Edit Vehicle tax').click();
    button(fixture, 'Delete sinking fund Vehicle tax').click();

    expect(added).toBe(1);
    expect(edited).toEqual([fund]);
    expect(removed).toEqual([fund]);
  });
});
