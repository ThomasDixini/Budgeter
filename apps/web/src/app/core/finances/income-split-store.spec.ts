import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Clock } from '../calendar/clock';
import { FixedClock } from '../calendar/fixed-clock';
import { IdGenerator } from '../ids/id-generator';
import { SequentialIdGenerator } from '../ids/sequential-id-generator';
import { FakeFinanceReferencesGateway, FakeTransactionsGateway } from './fake-finances-gateways';
import { FakeIncomeSplitGateway, SAMPLE_SPLIT } from './fake-income-split-gateway';
import { IncomeSplitGateway } from './income-split-gateway';
import { IncomeSplitStore } from './income-split-store';
import { Transaction } from './transaction';
import { FinanceReferencesGateway, TransactionsGateway } from './transactions-gateway';

/** Saturday, October 31, 2026. */
const HALLOWEEN = new Date(2026, 9, 31, 20, 0);

function inMonth(id: string, date: string, categoryId: string, amountCents: number): Transaction {
  return { id, date, description: id, categoryId, accountId: 'checking-account', amountCents };
}

/** Records reported errors instead of logging them. */
class RecordingErrorHandler extends ErrorHandler {
  readonly errors: unknown[] = [];

  override handleError(error: unknown): void {
    this.errors.push(error);
  }
}

function createStore(
  gateway = new FakeIncomeSplitGateway(),
  references = new FakeFinanceReferencesGateway(),
): { store: IncomeSplitStore; errors: RecordingErrorHandler } {
  const errors = new RecordingErrorHandler();
  const transactions = new FakeTransactionsGateway(
    new Map([
      [
        '2026-09',
        [
          inMonth('salary', '2026-09-05', 'salary', 950000),
          inMonth('gift', '2026-09-20', 'extra-income', 20000),
        ],
      ],
      ['2026-10', [inMonth('lunch', '2026-10-10', 'food', -150000)]],
    ]),
  );
  TestBed.configureTestingModule({
    providers: [
      IncomeSplitStore,
      { provide: IncomeSplitGateway, useValue: gateway },
      { provide: TransactionsGateway, useValue: transactions },
      { provide: FinanceReferencesGateway, useValue: references },
      { provide: Clock, useValue: new FixedClock(HALLOWEEN) },
      { provide: IdGenerator, useValue: new SequentialIdGenerator() },
      { provide: ErrorHandler, useValue: errors },
    ],
  });
  return { store: TestBed.inject(IncomeSplitStore), errors };
}

describe('IncomeSplitStore loading', () => {
  it('loads the saved split, this month and last month', () => {
    const { store } = createStore();

    expect([
      store.split(),
      store.isLoaded(),
      store.hasChanges(),
      store.progress()[0].spentCents,
      store.lastMonthIncomeCents(),
      store.lastMonthSalaryCents(),
    ]).toEqual([SAMPLE_SPLIT, true, false, 150000, 970000, 950000]);
  });

  it('offers to try again after a failed load, then loads what was missing', () => {
    const gateway = new FakeIncomeSplitGateway();
    gateway.failure = new Error('offline');
    const { store } = createStore(gateway);
    const failed = store.hasLoadFailed();

    gateway.failure = undefined;
    store.reload();

    expect([failed, store.hasLoadFailed(), store.isLoaded()]).toEqual([true, false, true]);
  });
});

describe('IncomeSplitStore editing', () => {
  it('keeps edits local until they are saved', () => {
    const gateway = new FakeIncomeSplitGateway();
    const { store } = createStore(gateway);

    store.setPercent('fun', 40);

    expect([store.hasChanges(), store.status().kind, gateway.saved]).toEqual([
      true,
      'balanced',
      [],
    ]);
  });

  it('adds a part with the next id and measures it against the month', () => {
    const { store } = createStore();

    store.addPart();
    store.assignCategory('id-1', 'food');

    expect([store.split().parts.map((part) => part.id), store.progress()[0].spentCents]).toEqual([
      ['fixed', 'fun', 'id-1'],
      0,
    ]);
  });

  it('applies a preset with fresh ids, keeping the base income', () => {
    const { store } = createStore();

    store.applyPreset(store.presets[2]);

    expect([store.split().parts.map((part) => part.id), store.split().baseIncomeCents]).toEqual([
      ['id-1', 'id-2', 'id-3'],
      950000,
    ]);
  });

  it('edits the base income, names, colors and parts', () => {
    const { store } = createStore();

    store.setBaseIncome(1000000);
    store.rename('fun', 'Fun');
    store.nextColor('fun');
    store.removePart('fixed');

    expect(store.split()).toEqual({
      baseIncomeCents: 1000000,
      parts: [{ id: 'fun', name: 'Fun', percent: 10, color: 5, categoryIds: [] }],
    });
  });

  it('unassigns a category', () => {
    const { store } = createStore();

    store.unassignCategory('food');

    expect(store.split().parts[0].categoryIds).toEqual([]);
  });
});

describe('IncomeSplitStore saving', () => {
  it('saves the split on screen and no longer counts it as changed', () => {
    const gateway = new FakeIncomeSplitGateway();
    const { store } = createStore(gateway);
    store.setPercent('fun', 40);

    store.save();

    expect([
      gateway.saved.map((split) => split.parts[1].percent),
      store.hasChanges(),
      store.isSaving(),
    ]).toEqual([[40], false, false]);
  });

  it('keeps the edits and reports the error when the save is rejected', () => {
    const gateway = new FakeIncomeSplitGateway();
    const { store, errors } = createStore(gateway);
    store.setPercent('fun', 40);
    gateway.failure = new Error('offline');

    store.save();

    expect([
      store.hasChanges(),
      store.split().parts[1].percent,
      errors.errors.length,
      store.isSaving(),
    ]).toEqual([true, 40, 1, false]);
  });
});

describe('IncomeSplitStore categories', () => {
  it('adds, renames and deletes categories through the shared list', () => {
    const references = new FakeFinanceReferencesGateway();
    const { store } = createStore(new FakeIncomeSplitGateway(), references);

    store.addCategory(' Courses ');
    store.renameCategory('food', 'Meals');
    store.deleteCategory('health');

    expect([
      store.categories().map((category) => category.name),
      references.savedCategories.map((category) => category.name),
      references.deletedCategories,
    ]).toEqual([['Courses', 'Meals', 'Salary'], ['Courses', 'Meals'], ['health']]);
  });

  it('lets the split go of a deleted category once it is stored', () => {
    const { store } = createStore();

    store.deleteCategory('food');

    expect([store.split().parts[0].categoryIds, store.hasChanges()]).toEqual([[], false]);
  });

  it('keeps the category in the split when its deletion is rejected', () => {
    const references = new FakeFinanceReferencesGateway();
    const { store } = createStore(new FakeIncomeSplitGateway(), references);
    references.failure = new Error('has transactions');

    store.deleteCategory('food');

    expect([
      store.split().parts[0].categoryIds,
      store.categories().map((category) => category.id),
    ]).toEqual([['food'], ['food', 'health', 'salary']]);
  });
});
