import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { Category } from '../../../../core/routines/category';
import { WEEKDAY_LABELS } from '../../../../core/routines/routine';
import { TASK_REPEAT_OPTIONS, Task, TaskDraft, TaskRepeat } from '../../../../core/routines/task';

/**
 * Inline form on the Today card: what the task is, how often it repeats (or on which day, for a
 * one-time task) and its category. Sets a new task, or edits the one given in `task`.
 */
@Component({
  selector: 'app-task-form',
  templateUrl: './task-form.html',
  styleUrl: './task-form.css',
})
export class TaskForm {
  readonly categories = input.required<readonly Category[]>();
  /** Today's weekday (Monday = 0), preselected when a new task repeats on some days. */
  readonly weekday = input.required<number>();
  /** Today as an ISO date: the default day of a one-time task. */
  readonly today = input.required<string>();
  /** The task being edited; leave unset to set a new one. */
  readonly task = input<Task | undefined>(undefined);
  readonly save = output<TaskDraft>();
  readonly dismiss = output();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // The form opens at the top of the card, which can be far from the row that opened it (or off
    // screen on a phone): put the cursor in the title so the user lands on it.
    afterNextRender(() =>
      this.host.nativeElement.querySelector<HTMLInputElement>('input')?.focus(),
    );
  }

  protected readonly repeatOptions = TASK_REPEAT_OPTIONS;
  protected readonly weekdayLabels = WEEKDAY_LABELS;
  protected readonly isEditing = computed(() => this.task() !== undefined);
  // Linked to the task so the fields follow it: they fill in when the form opens on a task and
  // refill if it is pointed at another one, instead of keeping what was typed for the previous.
  protected readonly title = linkedSignal(() => this.task()?.title ?? '');
  protected readonly categoryId = linkedSignal(() => this.task()?.categoryId ?? '');
  protected readonly repeat = linkedSignal<TaskRepeat>(() => this.task()?.repeat ?? 'once');
  protected readonly date = linkedSignal(() => this.task()?.date ?? this.today());
  private readonly pickedDays = linkedSignal<readonly number[] | undefined>(() => {
    const days = this.task()?.days ?? [];
    return days.length > 0 ? days : undefined;
  });
  protected readonly days = computed(() => this.pickedDays() ?? [this.weekday()]);
  /**
   * The earliest day the date field accepts: today, or the task's own day when that is earlier, so
   * an overdue task can still be saved (to change its title, say) without picking a new date.
   */
  protected readonly earliestDate = computed(() => {
    const own = this.task()?.date;
    return own !== undefined && own < this.today() ? own : this.today();
  });
  protected readonly canSave = computed(
    () =>
      this.title().trim() !== '' &&
      (this.repeat() !== 'weekly' || this.days().length > 0) &&
      (this.repeat() !== 'once' || this.date() >= this.earliestDate()),
  );

  protected toggleDay(day: number): void {
    const days = this.days();
    this.pickedDays.set(
      days.includes(day) ? days.filter((current) => current !== day) : [...days, day],
    );
  }

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    if (!this.canSave()) return;
    this.save.emit({
      title: this.title().trim(),
      categoryId: this.categoryId() || undefined,
      repeat: this.repeat(),
      days:
        this.repeat() === 'weekly' ? [...this.days()].sort((first, second) => first - second) : [],
      date: this.repeat() === 'once' ? this.date() : undefined,
    });
  }

  protected valueOf(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }
}
