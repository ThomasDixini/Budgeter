import { Component, computed, input, output, signal } from '@angular/core';
import { Category } from '../../../../core/routines/category';
import { WEEKDAY_LABELS } from '../../../../core/routines/routine';
import { TASK_REPEAT_OPTIONS, TaskDraft, TaskRepeat } from '../../../../core/routines/task';

/** Inline form on the Today card: what the task is, how often it repeats and its category. */
@Component({
  selector: 'app-task-form',
  templateUrl: './task-form.html',
  styleUrl: './task-form.css',
})
export class TaskForm {
  readonly categories = input.required<readonly Category[]>();
  /** Today's weekday (Monday = 0), preselected when the task repeats on some days. */
  readonly weekday = input.required<number>();
  readonly create = output<TaskDraft>();
  readonly dismiss = output();

  protected readonly repeatOptions = TASK_REPEAT_OPTIONS;
  protected readonly weekdayLabels = WEEKDAY_LABELS;
  protected readonly title = signal('');
  protected readonly categoryId = signal('');
  protected readonly repeat = signal<TaskRepeat>('once');
  private readonly pickedDays = signal<readonly number[] | undefined>(undefined);
  protected readonly days = computed(() => this.pickedDays() ?? [this.weekday()]);
  protected readonly canCreate = computed(
    () => this.title().trim() !== '' && (this.repeat() !== 'weekly' || this.days().length > 0),
  );

  protected toggleDay(day: number): void {
    const days = this.days();
    this.pickedDays.set(
      days.includes(day) ? days.filter((current) => current !== day) : [...days, day],
    );
  }

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    if (!this.canCreate()) return;
    this.create.emit({
      title: this.title().trim(),
      categoryId: this.categoryId() || undefined,
      repeat: this.repeat(),
      days:
        this.repeat() === 'weekly' ? [...this.days()].sort((first, second) => first - second) : [],
    });
  }

  protected valueOf(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }
}
