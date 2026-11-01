import { Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { findCategory } from '../../../../core/routines/category';
import {
  GOAL_TYPE_LABELS,
  Goal,
  goalPeriodInfo,
  goalProgress,
  goalValueLabel,
  isGoalMet,
} from '../../../../core/routines/goal';
import { RoutinesStore } from '../../../../core/routines/routines-store';

/** Goals shown while the card is closed. */
const FOCUS_GOAL_COUNT = 3;

interface FocusGoalView {
  readonly goal: Goal;
  readonly meta: string;
  readonly value: string;
  readonly percent: number;
  readonly color: string;
  readonly isMet: boolean;
}

/**
 * The goals card of the Today page: the first goals still pending, or every goal with how many are
 * met once "See all" opens it. Objectives are marked achieved from here.
 */
@Component({
  selector: 'app-today-goals',
  imports: [NgTemplateOutlet],
  templateUrl: './today-goals.html',
  styleUrl: './today-goals.css',
  host: { role: 'region', 'aria-labelledby': 'goals-title' },
})
export class TodayGoals {
  private readonly store = inject(RoutinesStore);

  /** Whether "See all" opened the card to every goal, instead of the first few still pending. */
  protected readonly isShowingAllGoals = signal(false);
  protected readonly goalCount = computed(() => this.store.goals().length);
  protected readonly pendingGoals = computed(() =>
    this.store
      .goals()
      .filter((goal) => !isGoalMet(goal))
      .map((goal) => this.toFocusGoal(goal)),
  );
  protected readonly metGoals = computed(() =>
    this.store
      .goals()
      .filter(isGoalMet)
      .map((goal) => this.toFocusGoal(goal)),
  );
  /** The first goals still pending, shown while the card is closed. */
  protected readonly focusGoals = computed(() => this.pendingGoals().slice(0, FOCUS_GOAL_COUNT));
  /** Share of goals met in their current period, for the summary bar of "All goals". */
  protected readonly metPercent = computed(() =>
    this.goalCount() === 0 ? 0 : Math.round((this.metGoals().length / this.goalCount()) * 100),
  );

  /**
   * Marks an objective achieved today, or takes the mark back.
   * @example this.toggleAchieved(courseObjective)
   */
  protected toggleAchieved(goal: Goal): void {
    this.store.setAchieved(goal.id, goal.achievedOn === undefined);
  }

  private toFocusGoal(goal: Goal): FocusGoalView {
    const category = findCategory(this.store.categories(), goal.categoryId);
    return {
      goal,
      meta: [GOAL_TYPE_LABELS[goal.type], goalPeriodInfo(goal.period).label, category?.name]
        .filter((part) => part !== undefined)
        .join(' · '),
      value: goal.type === 'objective' ? goalValueLabel(goal) : `${goal.done}/${goal.target}`,
      percent: goalProgress(goal),
      color: category?.color ?? 'var(--color-mint)',
      isMet: isGoalMet(goal),
    };
  }
}
