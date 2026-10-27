import { Component, computed, input, output } from '@angular/core';
import {
  Goal,
  goalFooter,
  goalProgress,
  goalTag,
  goalValueLabel,
  usesDots,
} from '../../../../core/routines/goal';

/** One goal: its type badge, dots or bar for progress, and a +1 button to log progress. */
@Component({
  selector: 'app-goal-card',
  templateUrl: './goal-card.html',
  styleUrl: './goal-card.css',
})
export class GoalCard {
  readonly goal = input.required<Goal>();
  readonly color = input.required<string>();
  readonly today = input.required<Date>();
  readonly increment = output<string>();

  protected readonly tag = computed(() => goalTag(this.goal()));
  protected readonly value = computed(() => goalValueLabel(this.goal()));
  protected readonly footer = computed(() => goalFooter(this.goal(), this.today()));
  protected readonly percent = computed(() => goalProgress(this.goal()));
  protected readonly showsDots = computed(() => usesDots(this.goal()));
  protected readonly dots = computed(() =>
    Array.from({ length: this.goal().target }, (_, index) => index < this.goal().done),
  );
}
