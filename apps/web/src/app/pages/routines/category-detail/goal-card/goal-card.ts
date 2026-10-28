import { Component, computed, input, output, signal } from '@angular/core';
import {
  Goal,
  goalFooter,
  goalProgress,
  goalTag,
  goalTrackingNote,
  goalValueLabel,
  usesDots,
} from '../../../../core/routines/goal';

/** One goal: its type badge, dots or bar for progress, and buttons to log, take back, edit and delete. */
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
  readonly decrement = output<string>();
  readonly edit = output<string>();
  readonly remove = output<string>();

  protected readonly isConfirmingDelete = signal(false);
  protected readonly trackingNote = computed(() => goalTrackingNote(this.goal()));
  /** A goal fed by blocks or tasks counts by itself, so +1 and −1 do not apply to it. */
  protected readonly isAutomatic = computed(() => this.goal().tracking !== 'manual');
  /** At the target there is nothing left to log: the API ignores a repetition past it. */
  protected readonly isComplete = computed(() => this.goal().done >= this.goal().target);

  protected readonly tag = computed(() => goalTag(this.goal()));
  protected readonly value = computed(() => goalValueLabel(this.goal()));
  protected readonly footer = computed(() => goalFooter(this.goal(), this.today()));
  protected readonly percent = computed(() => goalProgress(this.goal()));
  protected readonly showsDots = computed(() => usesDots(this.goal()));
  protected readonly dots = computed(() =>
    Array.from({ length: this.goal().target }, (_, index) => index < this.goal().done),
  );

  protected confirmDelete(): void {
    this.isConfirmingDelete.set(false);
    this.remove.emit(this.goal().id);
  }
}
