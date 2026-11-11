import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FinanceCategory } from '../../../../core/finances/finance-references';
import { SinkingFund, SinkingFundDraft } from '../../../../core/finances/sinking-funds';
import { SinkingFundForm } from './sinking-fund-form';

interface Saved {
  id: string | null;
  draft: SinkingFundDraft;
}

const TODAY = '2026-11-03';
const CATEGORIES: readonly FinanceCategory[] = [
  { id: 'category-1', name: 'Housing' },
  { id: 'category-2', name: 'Transport' },
];

function fundOf(overrides: Partial<SinkingFund> = {}): SinkingFund {
  return {
    id: 'fund-1',
    description: 'Vehicle tax',
    categoryId: 'category-2',
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

const EVERY_MONTHS_FUND = fundOf({
  description: 'Car service',
  amountCents: 45_050,
  schedule: { kind: 'everyMonths', intervalMonths: 6, day: 15, nextDueDate: '2027-02-15' },
});

interface Rendered {
  fixture: ComponentFixture<SinkingFundForm>;
  saved: Saved[];
  cancelled: number[];
}

function render(fund: SinkingFund | null = null): Rendered {
  const fixture = TestBed.createComponent(SinkingFundForm);
  fixture.componentRef.setInput('fund', fund);
  fixture.componentRef.setInput('categories', CATEGORIES);
  fixture.componentRef.setInput('today', TODAY);
  const saved: Saved[] = [];
  const cancelled: number[] = [];
  fixture.componentInstance.saved.subscribe((value) => saved.push(value));
  fixture.componentInstance.cancelled.subscribe(() => cancelled.push(1));
  fixture.detectChanges();
  return { fixture, saved, cancelled };
}

function root(fixture: ComponentFixture<SinkingFundForm>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function field<T extends HTMLElement>(fixture: ComponentFixture<SinkingFundForm>, name: string): T {
  const found = root(fixture).querySelector<T>(`[name="${name}"]`);
  if (found === null) throw new Error(`Expected a field named "${name}" in the form`);
  return found;
}

function hasField(fixture: ComponentFixture<SinkingFundForm>, name: string): boolean {
  return root(fixture).querySelector(`[name="${name}"]`) !== null;
}

function type(fixture: ComponentFixture<SinkingFundForm>, name: string, value: string): void {
  const input = field<HTMLInputElement>(fixture, name);
  input.value = value;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('change'));
  fixture.detectChanges();
}

function choose(fixture: ComponentFixture<SinkingFundForm>, name: string, value: string): void {
  const select = field<HTMLSelectElement>(fixture, name);
  select.value = value;
  select.dispatchEvent(new Event('change'));
  fixture.detectChanges();
}

function saveButton(fixture: ComponentFixture<SinkingFundForm>): HTMLButtonElement {
  return root(fixture).querySelector<HTMLButtonElement>('button[type="submit"]')!;
}

function submit(fixture: ComponentFixture<SinkingFundForm>): void {
  root(fixture)
    .querySelector('form')!
    .dispatchEvent(new SubmitEvent('submit', { cancelable: true }));
  fixture.detectChanges();
}

function fillCommon(fixture: ComponentFixture<SinkingFundForm>): void {
  type(fixture, 'description', '  Vehicle tax  ');
  choose(fixture, 'category', 'category-2');
  type(fixture, 'amount', '1200,00');
}

describe('SinkingFundForm', () => {
  it('shows the new heading when there is no fund', () => {
    const { fixture } = render();

    expect(root(fixture).querySelector('.heading')?.textContent?.trim()).toBe('New sinking fund');
  });

  it('shows the edit heading and prefills an every-months fund', () => {
    const { fixture } = render(EVERY_MONTHS_FUND);

    expect(root(fixture).querySelector('.heading')?.textContent?.trim()).toBe('Edit sinking fund');
    expect(field<HTMLInputElement>(fixture, 'description').value).toBe('Car service');
    expect(field<HTMLSelectElement>(fixture, 'category').value).toBe('category-2');
    expect(field<HTMLInputElement>(fixture, 'amount').value).toBe('450.50');
    expect(field<HTMLInputElement>(fixture, 'intervalMonths').value).toBe('6');
    expect(field<HTMLInputElement>(fixture, 'nextDueDate').value).toBe('2027-02-15');
  });

  it('prefills the month and day of a fixed-date fund without a due date field', () => {
    const { fixture } = render(fundOf());

    expect(field<HTMLInputElement>(fixture, 'month').value).toBe('1');
    expect(field<HTMLInputElement>(fixture, 'day').value).toBe('20');
    expect(hasField(fixture, 'nextDueDate')).toBe(false);
    expect(hasField(fixture, 'intervalMonths')).toBe(false);
  });

  it('shows only the fields of the chosen repeat kind', () => {
    const { fixture } = render();

    expect(hasField(fixture, 'intervalMonths')).toBe(true);
    expect(hasField(fixture, 'nextDueDate')).toBe(true);
    expect(hasField(fixture, 'month')).toBe(false);
    choose(fixture, 'kind', 'fixedDate');
    expect(hasField(fixture, 'intervalMonths')).toBe(false);
    expect(hasField(fixture, 'month')).toBe(true);
    expect(hasField(fixture, 'day')).toBe(true);
  });

  it('emits a new every-months fund with the amount in cents', () => {
    const { fixture, saved } = render();
    fillCommon(fixture);
    type(fixture, 'intervalMonths', '3');
    type(fixture, 'nextDueDate', '2027-01-10');

    submit(fixture);

    expect(saved).toEqual([
      {
        id: null,
        draft: {
          description: 'Vehicle tax',
          categoryId: 'category-2',
          amountCents: 120_000,
          schedule: { kind: 'everyMonths', intervalMonths: 3, nextDueDate: '2027-01-10' },
        },
      },
    ]);
  });

  it('emits a fixed-date fund and keeps the common fields when switching kind', () => {
    const { fixture, saved } = render();
    fillCommon(fixture);
    choose(fixture, 'kind', 'fixedDate');
    type(fixture, 'month', '1');
    type(fixture, 'day', '31');

    submit(fixture);

    expect(saved).toEqual([
      {
        id: null,
        draft: {
          description: 'Vehicle tax',
          categoryId: 'category-2',
          amountCents: 120_000,
          schedule: { kind: 'fixedDate', month: 1, day: 31 },
        },
      },
    ]);
  });

  it('emits the edited fund id', () => {
    const { fixture, saved } = render(fundOf());

    submit(fixture);

    expect(saved[0]?.id).toBe('fund-1');
    expect(saved[0]?.draft.schedule).toEqual({ kind: 'fixedDate', month: 1, day: 20 });
  });

  it('accepts a next due date equal to today', () => {
    const { fixture, saved } = render();
    fillCommon(fixture);
    type(fixture, 'nextDueDate', TODAY);

    submit(fixture);

    expect(saved).toHaveLength(1);
  });

  it('blocks saving without a description', () => {
    const { fixture, saved } = render(EVERY_MONTHS_FUND);
    type(fixture, 'description', '   ');

    submit(fixture);

    expect(saved).toEqual([]);
    expect(saveButton(fixture).disabled).toBe(true);
  });

  it('blocks saving without a category', () => {
    const { fixture, saved } = render();
    type(fixture, 'description', 'Vehicle tax');
    type(fixture, 'amount', '1200,00');

    submit(fixture);

    expect(saved).toEqual([]);
  });

  it('blocks saving an amount of zero and shows why', () => {
    const { fixture, saved } = render(EVERY_MONTHS_FUND);
    type(fixture, 'amount', '0,00');

    submit(fixture);

    expect(saved).toEqual([]);
    expect(root(fixture).querySelector('.error')?.textContent).toContain('above zero');
    expect(field(fixture, 'amount').getAttribute('aria-invalid')).toBe('true');
  });

  it('blocks an interval outside 1 to 60 and shows why', () => {
    const { fixture, saved } = render(EVERY_MONTHS_FUND);

    for (const value of ['0', '61', '2.5', '']) {
      type(fixture, 'intervalMonths', value);
      submit(fixture);
    }

    expect(saved).toEqual([]);
    type(fixture, 'intervalMonths', '61');
    expect(root(fixture).querySelector('.error')?.textContent).toContain('from 1 to 60');
  });

  it('blocks a next due date before today and shows why', () => {
    const { fixture, saved } = render(EVERY_MONTHS_FUND);
    type(fixture, 'nextDueDate', '2026-11-02');

    submit(fixture);

    expect(saved).toEqual([]);
    expect(root(fixture).querySelector('.error')).not.toBeNull();
  });

  it('blocks a month outside 1 to 12', () => {
    const { fixture, saved } = render(fundOf());

    for (const value of ['0', '13', '']) {
      type(fixture, 'month', value);
      submit(fixture);
    }

    expect(saved).toEqual([]);
  });

  it('blocks a day outside 1 to 31', () => {
    const { fixture, saved } = render(fundOf());

    for (const value of ['0', '32', '']) {
      type(fixture, 'day', value);
      submit(fixture);
    }

    expect(saved).toEqual([]);
  });

  it('emits cancelled from the Cancel button and from Escape', () => {
    const { fixture, cancelled } = render();
    const cancel = root(fixture).querySelector<HTMLButtonElement>('button[type="button"]')!;

    cancel.click();
    root(fixture)
      .querySelector('form')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(cancelled).toHaveLength(2);
  });
});
