import { Component, computed, input, output, signal } from '@angular/core';
import {
  Goal,
  goalExtra,
  goalFooter,
  goalProgress,
  goalTag,
  goalValueLabel,
  isGoalMet,
  usesDots,
} from '../../../../core/routines/goal';

/**
 * One goal: its type badge, dots or bar for progress, and buttons to edit and delete it. A frequency
 * goal counts completed blocks by itself; an objective has a button to mark it achieved.
 */
@Component({
  selector: 'app-goal-card',
  templateUrl: './goal-card.html',
  styleUrl: './goal-card.css',
})
export class GoalCard {
  readonly goal = input.required<Goal>();
  readonly color = input.required<string>();
  readonly today = input.required<Date>();
  /** Emits the objective's id when it is marked achieved, or the mark is taken back. */
  readonly toggleAchieved = output<string>();
  readonly edit = output<string>();
  readonly remove = output<string>();

  protected readonly isConfirmingDelete = signal(false);
  protected readonly isObjective = computed(() => this.goal().type === 'objective');
  protected readonly isMet = computed(() => isGoalMet(this.goal()));

  protected readonly tag = computed(() => goalTag(this.goal()));
  protected readonly value = computed(() => goalValueLabel(this.goal()));
  protected readonly footer = computed(() => goalFooter(this.goal(), this.today()));
  protected readonly percent = computed(() => goalProgress(this.goal()));
  protected readonly showsDots = computed(() => usesDots(this.goal()));
  protected readonly dots = computed(() =>
    Array.from({ length: this.goal().target }, (_, index) => index < this.goal().done),
  );
  /** Blocks completed beyond the target, shown after the dots as "+2". */
  protected readonly extra = computed(() => goalExtra(this.goal()));

  protected confirmDelete(): void {
    this.isConfirmingDelete.set(false);
    this.remove.emit(this.goal().id);
  }
}
