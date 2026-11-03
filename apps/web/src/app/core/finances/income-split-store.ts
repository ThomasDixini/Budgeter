import { ErrorHandler, Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { Clock } from '../calendar/clock';
import { IdGenerator } from '../ids/id-generator';
import { FinanceReferencesStore } from './finance-references-store';
import {
  EMPTY_SPLIT,
  IncomeSplit,
  SPLIT_PRESETS,
  SplitPreset,
  incomeReceivedCents,
  incomeReceivedIn,
  partProgress,
  sameSplit,
  splitStatus,
  withAddedPart,
  withBaseIncome,
  withCategoryIn,
  withName,
  withNextColor,
  withPercent,
  withPreset,
  withoutCategory,
  withoutPart,
} from './income-split';
import { IncomeSplitGateway } from './income-split-gateway';
import { Transaction } from './transaction';
import { monthOf, shiftMonth } from './transaction-month';
import { TransactionsGateway } from './transactions-gateway';

/** The starter category salary comes in under, which "salary only" reads. */
const SALARY_CATEGORY_ID = 'salary';

/**
 * The income split being edited, next to the saved one, and the transactions it is measured against:
 * this month's expenses (what was really spent) and last month's income (what to base the plan on).
 * Edits stay local until saved; a failed save keeps them, so nothing typed is lost. Provided by the
 * page, so each visit starts from what is stored.
 */
@Injectable()
export class IncomeSplitStore {
  private readonly gateway = inject(IncomeSplitGateway);
  private readonly transactionsGateway = inject(TransactionsGateway);
  private readonly references = inject(FinanceReferencesStore);
  private readonly ids = inject(IdGenerator);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly currentMonth = monthOf(inject(Clock).now());
  private readonly savedSplit = signal<IncomeSplit>(EMPTY_SPLIT);
  private readonly draftSplit = signal<IncomeSplit>(EMPTY_SPLIT);
  private readonly splitLoaded = signal(false);
  private readonly transactionsLoaded = signal(false);
  private readonly thisMonth = signal<readonly Transaction[]>([]);
  private readonly lastMonth = signal<readonly Transaction[]>([]);
  private readonly loadFailed = signal(false);
  private readonly saving = signal(false);

  /** The `YYYY-MM` month the real spending is read from. */
  readonly month = this.currentMonth;
  /** The `YYYY-MM` month before it, whose income the plan can be based on. */
  readonly previousMonth = shiftMonth(this.currentMonth, -1);
  readonly categories = this.references.categories;
  readonly split = this.draftSplit.asReadonly();
  readonly presets = SPLIT_PRESETS;
  readonly isLoaded = computed(
    () => this.splitLoaded() && this.transactionsLoaded() && this.references.isLoaded(),
  );
  readonly hasLoadFailed = computed(() => this.loadFailed() || this.references.hasLoadFailed());
  readonly isSaving = this.saving.asReadonly();
  /** Whether the split on screen differs from the stored one. */
  readonly hasChanges = computed(() => !sameSplit(this.draftSplit(), this.savedSplit()));
  readonly status = computed(() => splitStatus(this.draftSplit()));
  readonly progress = computed(() => partProgress(this.draftSplit(), this.thisMonth()));
  /** Everything that came in last month. */
  readonly lastMonthIncomeCents = computed(() => incomeReceivedCents(this.lastMonth()));
  /** The salary that came in last month. */
  readonly lastMonthSalaryCents = computed(() =>
    incomeReceivedIn(this.lastMonth(), SALARY_CATEGORY_ID),
  );

  constructor() {
    this.loadSplit();
    this.loadTransactions();
  }

  /**
   * Loads again whatever did not arrive, after a failed load.
   * @example store.reload()
   */
  reload(): void {
    this.references.reload();
    this.loadFailed.set(false);
    if (!this.splitLoaded()) this.loadSplit();
    if (!this.transactionsLoaded()) this.loadTransactions();
  }

  /** @example store.setBaseIncome(950000) */
  setBaseIncome(cents: number): void {
    this.edit((split) => withBaseIncome(split, cents));
  }

  /** @example store.setPercent('fixed', 60) */
  setPercent(partId: string, percent: number): void {
    this.edit((split) => withPercent(split, partId, percent));
  }

  /** @example store.rename('fixed', 'Fixed costs') */
  rename(partId: string, name: string): void {
    this.edit((split) => withName(split, partId, name));
  }

  /** @example store.nextColor('fixed') */
  nextColor(partId: string): void {
    this.edit((split) => withNextColor(split, partId));
  }

  /** @example store.addPart() */
  addPart(): void {
    this.edit((split) => withAddedPart(split, this.ids.next()));
  }

  /** @example store.removePart('fixed') */
  removePart(partId: string): void {
    this.edit((split) => withoutPart(split, partId));
  }

  /** @example store.assignCategory('fun', 'leisure') */
  assignCategory(partId: string, categoryId: string): void {
    this.edit((split) => withCategoryIn(split, partId, categoryId));
  }

  /** @example store.unassignCategory('leisure') */
  unassignCategory(categoryId: string): void {
    this.edit((split) => withoutCategory(split, categoryId));
  }

  /** @example store.applyPreset(SPLIT_PRESETS[0]) */
  applyPreset(preset: SplitPreset): void {
    this.edit((split) =>
      withPreset(
        split,
        preset,
        preset.parts.map(() => this.ids.next()),
      ),
    );
  }

  /**
   * Saves the split on screen as the plan. The edits stay on screen if the gateway rejects it.
   * @example store.save()
   */
  save(): void {
    const split = this.draftSplit();
    this.saving.set(true);
    this.gateway.save(split).subscribe({
      next: () => {
        this.savedSplit.set(split);
        this.saving.set(false);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.errorHandler.handleError(error);
      },
    });
  }

  /** @example store.addCategory('Courses') */
  addCategory(name: string): void {
    this.references.addCategory(name);
  }

  /** @example store.renameCategory('courses', 'Study') */
  renameCategory(categoryId: string, name: string): void {
    this.references.renameCategory(categoryId, name);
  }

  /**
   * Deletes a category; once the API stored that, the plan lets go of it too (the API did already).
   * @example store.deleteCategory('courses')
   */
  deleteCategory(categoryId: string): void {
    this.references.deleteCategory(categoryId, () => this.letGo(categoryId));
  }

  private edit(change: (split: IncomeSplit) => IncomeSplit): void {
    this.draftSplit.update(change);
  }

  private letGo(categoryId: string): void {
    this.savedSplit.update((split) => withoutCategory(split, categoryId));
    this.draftSplit.update((split) => withoutCategory(split, categoryId));
  }

  private loadSplit(): void {
    this.gateway.get().subscribe({
      next: (split) => {
        this.savedSplit.set(split);
        this.draftSplit.set(split);
        this.splitLoaded.set(true);
      },
      error: (error: unknown) => this.failedToLoad(error),
    });
  }

  private loadTransactions(): void {
    forkJoin({
      last: this.transactionsGateway.listMonth(this.previousMonth),
      current: this.transactionsGateway.listMonth(this.currentMonth),
    }).subscribe({
      next: ({ last, current }) => {
        this.lastMonth.set(last);
        this.thisMonth.set(current);
        this.transactionsLoaded.set(true);
      },
      error: (error: unknown) => this.failedToLoad(error),
    });
  }

  private failedToLoad(error: unknown): void {
    this.loadFailed.set(true);
    this.errorHandler.handleError(error);
  }
}
