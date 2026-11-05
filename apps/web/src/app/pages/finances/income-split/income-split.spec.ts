import { ErrorHandler } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Clock } from '../../../core/calendar/clock';
import { FixedClock } from '../../../core/calendar/fixed-clock';
import {
  FakeFinanceReferencesGateway,
  FakeTransactionsGateway,
} from '../../../core/finances/fake-finances-gateways';
import { FakeIncomeSplitGateway } from '../../../core/finances/fake-income-split-gateway';
import { IncomeSplitGateway } from '../../../core/finances/income-split-gateway';
import { Transaction } from '../../../core/finances/transaction';
import {
  FinanceReferencesGateway,
  TransactionsGateway,
} from '../../../core/finances/transactions-gateway';
import { IdGenerator } from '../../../core/ids/id-generator';
import { SequentialIdGenerator } from '../../../core/ids/sequential-id-generator';
import { IncomeSplitPage } from './income-split';

/** Saturday, October 31, 2026. */
const HALLOWEEN = new Date(2026, 9, 31, 20, 0);

function inMonth(id: string, date: string, categoryId: string, amountCents: number): Transaction {
  return { id, date, description: id, categoryId, accountId: 'checking-account', amountCents };
}

/** Swallows the errors the page reports on purpose. */
class SilentErrorHandler extends ErrorHandler {
  override handleError(): void {
    // Reported failures are part of what these tests play out.
  }
}

function render(
  split = new FakeIncomeSplitGateway(),
  references = new FakeFinanceReferencesGateway(),
): ComponentFixture<IncomeSplitPage> {
  const transactions = new FakeTransactionsGateway(
    new Map([
      [
        '2026-09',
        [
          inMonth('salary', '2026-09-05', 'salary', 950000),
          inMonth('gift', '2026-09-20', 'extra-income', 20000),
        ],
      ],
      ['2026-10', [inMonth('market', '2026-10-10', 'food', -150000)]],
    ]),
  );
  TestBed.configureTestingModule({
    providers: [
      { provide: IncomeSplitGateway, useValue: split },
      { provide: TransactionsGateway, useValue: transactions },
      { provide: FinanceReferencesGateway, useValue: references },
      { provide: Clock, useValue: new FixedClock(HALLOWEEN) },
      { provide: IdGenerator, useValue: new SequentialIdGenerator() },
      { provide: ErrorHandler, useClass: SilentErrorHandler },
    ],
  });
  const fixture = TestBed.createComponent(IncomeSplitPage);
  fixture.detectChanges();
  return fixture;
}

function element(fixture: ComponentFixture<IncomeSplitPage>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function texts(fixture: ComponentFixture<IncomeSplitPage>, selector: string): string[] {
  return [...element(fixture).querySelectorAll(selector)].map(
    (node) => node.textContent?.replaceAll(/\s+/g, ' ').trim() ?? '',
  );
}

function click(fixture: ComponentFixture<IncomeSplitPage>, selector: string, label: string): void {
  const buttons = [...element(fixture).querySelectorAll<HTMLButtonElement>(selector)];
  buttons.find((button) => button.textContent?.trim().includes(label))!.click();
  fixture.detectChanges();
}

function type(fixture: ComponentFixture<IncomeSplitPage>, selector: string, value: string): void {
  const field = element(fixture).querySelector<HTMLInputElement>(selector)!;
  field.value = value;
  field.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

function saveButton(fixture: ComponentFixture<IncomeSplitPage>): HTMLButtonElement {
  return element(fixture).querySelector<HTMLButtonElement>('app-page-heading .ui-button-primary')!;
}

describe('Income split page', () => {
  it('shows the plan saved, what it comes to per month and how it adds up', () => {
    const fixture = render();

    expect([
      texts(fixture, 'app-split-parts .amount'),
      texts(fixture, 'app-split-overview .status'),
      saveButton(fixture).disabled,
    ]).toEqual([['R$5,700.00', 'R$950.00'], ['30% left · R$2,850.00 with no destination'], true]);
  });

  it('compares each part with what its categories spent this month', () => {
    const fixture = render();

    expect([
      texts(fixture, 'app-plan-vs-actual .status'),
      texts(fixture, 'app-plan-vs-actual h2'),
    ]).toEqual([['26% used', '0% used'], ['Planned vs actual · October 2026']]);
  });

  it('offers last month income as the base, and the salary alone', () => {
    const fixture = render();

    expect(texts(fixture, 'app-income-base .shortcuts button')).toEqual([
      'Use September income · R$9,700.00',
      'Salary only · R$9,500.00',
    ]);
  });

  it('turns the shortcut into the base income and asks to save', () => {
    const fixture = render();
    click(fixture, 'app-income-base .shortcuts button', 'Use September income');

    expect([
      (element(fixture).querySelector('input[name="baseIncome"]') as HTMLInputElement).value,
      saveButton(fixture).disabled,
      texts(fixture, '.unsaved'),
    ]).toEqual(['9700.00', false, ['Unsaved changes']]);
  });

  it('says so when the base income typed cannot be read, and keeps the last one', () => {
    const fixture = render();
    type(fixture, 'input[name="baseIncome"]', 'abc');

    expect([
      texts(fixture, 'app-income-base .error'),
      texts(fixture, 'app-split-parts .amount'),
    ]).toEqual([['Enter an income above zero, like 9500.00.'], ['R$5,700.00', 'R$950.00']]);
  });

  it('applies a template and saves the whole split', () => {
    const gateway = new FakeIncomeSplitGateway();
    const fixture = render(gateway);
    click(fixture, 'app-split-overview button', '50 · 30 · 20');

    saveButton(fixture).click();

    expect(gateway.saved[0].parts.map((part) => [part.name, part.percent])).toEqual([
      ['Needs', 50],
      ['Wants', 30],
      ['Investments', 20],
    ]);
  });

  it('assigns a category to a part, moving it from the part that had it', () => {
    const fixture = render();
    click(fixture, 'app-split-parts .pick', '+ categories');
    const leisure = [...element(fixture).querySelectorAll('.pick')][1] as HTMLButtonElement;
    leisure.click();
    fixture.detectChanges();

    click(fixture, '.picker .ui-chip', 'Food (from Fixed costs)');

    expect(texts(fixture, 'app-split-parts .categories .ui-tag')).toEqual(['Food']);
  });

  it('adds a part that takes what is unassigned, and removes one', () => {
    const fixture = render();
    click(fixture, 'app-split-parts .add', 'New part');

    const added = texts(fixture, 'app-split-parts .amount');
    (
      element(fixture).querySelector('[aria-label="Remove Fixed costs"]') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect([added, texts(fixture, 'app-split-parts .amount')]).toEqual([
      ['R$5,700.00', 'R$950.00', 'R$2,850.00'],
      ['R$950.00', 'R$2,850.00'],
    ]);
  });

  it('creates a category and lists it for the parts', () => {
    const references = new FakeFinanceReferencesGateway();
    const fixture = render(new FakeIncomeSplitGateway(), references);
    type(fixture, 'input[name="newCategory"]', 'Courses');

    (
      element(fixture).querySelector('form[aria-label="New category"]') as HTMLFormElement
    ).dispatchEvent(new SubmitEvent('submit', { cancelable: true }));
    fixture.detectChanges();

    expect(references.savedCategories.map((category) => category.name)).toEqual(['Courses']);
  });

  it('refuses a category name that is already taken', () => {
    const fixture = render();
    type(fixture, 'input[name="newCategory"]', ' food ');

    expect([
      texts(fixture, 'app-category-manager .error'),
      (
        element(fixture).querySelector(
          'app-category-manager form [type="submit"]',
        ) as HTMLButtonElement
      ).disabled,
    ]).toEqual([['A category with this name already exists.'], true]);
  });

  it('renames and deletes a category', () => {
    const references = new FakeFinanceReferencesGateway();
    const fixture = render(new FakeIncomeSplitGateway(), references);
    (element(fixture).querySelector('[aria-label="Rename Health"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    type(fixture, 'form[aria-label="Rename category"] input', 'Wellness');
    click(fixture, 'form[aria-label="Rename category"] button', 'Save');

    (element(fixture).querySelector('[aria-label="Delete Wellness"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect([
      references.savedCategories.map((category) => category.name),
      references.deletedCategories,
    ]).toEqual([['Wellness'], ['health']]);
  });

  it('offers to try again when the plan could not load', () => {
    const gateway = new FakeIncomeSplitGateway();
    gateway.failure = new Error('offline');
    const fixture = render(gateway);

    expect(texts(fixture, 'app-load-failed p')).toEqual(["Couldn't load your income split."]);
  });
});
