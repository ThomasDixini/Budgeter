import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { Clock } from '../../../core/calendar/clock';
import { formatDuration } from '../../../core/calendar/time-of-day';
import {
  CATEGORY_SWATCHES,
  Category,
  countLabel,
  withAlpha,
} from '../../../core/routines/category';
import { GoalChanges, averageProgress } from '../../../core/routines/goal';
import { GoalDraft, RoutinesStore } from '../../../core/routines/routines-store';
import { TasksStore } from '../../../core/routines/tasks-store';
import { GoalCard } from './goal-card/goal-card';
import { GoalForm } from './goal-form/goal-form';
import {
  PeriodFilter,
  TYPE_FILTERS,
  TypeFilter,
  matchesFilters,
  periodFilterOptions,
} from './goal-filters';

/** One category: its headline numbers, routine blocks and goals, with filters and a new-goal form. */
@Component({
  selector: 'app-category-detail',
  imports: [RouterLink, GoalCard, GoalForm],
  templateUrl: './category-detail.html',
  styleUrl: './category-detail.css',
})
export class CategoryDetail {
  private readonly store = inject(RoutinesStore);
  private readonly tasksStore = inject(TasksStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly categoryId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('categoryId') ?? '')),
    { initialValue: '' },
  );

  protected readonly today = inject(Clock).now();
  protected readonly typeFilters = TYPE_FILTERS;
  protected readonly periodFilter = signal<PeriodFilter>('all');
  protected readonly typeFilter = signal<TypeFilter>('all');
  protected readonly isAdding = signal(this.route.snapshot.queryParamMap.get('newGoal') === 'true');
  /** Id of the goal whose form is open for editing. */
  protected readonly editingGoalId = signal<string | undefined>(undefined);
  protected readonly isLoaded = this.store.isLoaded;
  protected readonly swatches = CATEGORY_SWATCHES;
  protected readonly isEditingCategory = signal(false);
  protected readonly isConfirmingDelete = signal(false);
  protected readonly draftName = signal('');
  protected readonly draftColor = signal('');

  protected readonly category = computed(() =>
    this.store.categories().find((category) => category.id === this.categoryId()),
  );
  protected readonly goals = computed(() =>
    this.store.goals().filter((goal) => goal.categoryId === this.categoryId()),
  );
  /**
   * The goal being edited, as a list of at most one: the template tracks it by id, so opening
   * another goal's form rebuilds it instead of reusing the one filled in for the previous goal.
   */
  protected readonly editingGoals = computed(() =>
    this.goals().filter((goal) => goal.id === this.editingGoalId()),
  );
  protected readonly blocks = computed(() => this.store.categoryBlocks(this.categoryId()));
  protected readonly stats = computed(() => ({
    goalCount: this.goals().length,
    average: averageProgress(this.goals()),
    weekly: formatDuration(this.store.weeklyMinutes(this.categoryId())),
    blocksLabel: `${countLabel(this.blocks().length, 'block')} in the routine`,
  }));
  protected readonly accent = computed(() => {
    const color = this.category()?.color ?? '#2EF2A6';
    return {
      color,
      tint: withAlpha(color, 0.12),
      ring: withAlpha(color, 0.4),
      glow: withAlpha(color, 0.08),
    };
  });
  protected readonly periodOptions = computed(() =>
    periodFilterOptions(this.goals(), this.typeFilter()),
  );
  protected readonly visibleGoals = computed(() =>
    this.goals().filter((goal) => matchesFilters(goal, this.periodFilter(), this.typeFilter())),
  );

  protected startEditingCategory(category: Category): void {
    this.isConfirmingDelete.set(false);
    this.draftName.set(category.name);
    this.draftColor.set(category.color);
    this.isEditingCategory.set(true);
  }

  protected saveCategory(event: SubmitEvent): void {
    event.preventDefault();
    const name = this.draftName().trim();
    if (name === '') return;
    this.store.updateCategory(this.categoryId(), name, this.draftColor());
    this.isEditingCategory.set(false);
  }

  protected deleteCategory(categoryId: string): void {
    this.store.deleteCategory(categoryId);
    this.tasksStore.detachCategory(categoryId);
    void this.router.navigate(['/routines/categories']);
  }

  protected valueOf(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected incrementGoal(goalId: string): void {
    this.store.incrementGoal(goalId);
  }

  protected decrementGoal(goalId: string): void {
    this.store.decrementGoal(goalId);
  }

  protected startEditing(goalId: string): void {
    this.isAdding.set(false);
    this.editingGoalId.set(goalId);
  }

  protected saveGoal(goalId: string, changes: GoalChanges): void {
    this.store.updateGoal(goalId, changes);
    this.editingGoalId.set(undefined);
  }

  protected deleteGoal(goalId: string): void {
    this.store.deleteGoal(goalId);
  }

  protected addGoal(draft: GoalDraft): void {
    this.store.addGoal(draft);
    this.isAdding.set(false);
    this.periodFilter.set('all');
    this.typeFilter.set('all');
  }
}
