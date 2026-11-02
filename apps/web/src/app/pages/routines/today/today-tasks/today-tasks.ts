import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { isoDate } from '../../../../core/calendar/date-label';
import { weekdayIndex } from '../../../../core/calendar/time-of-day';
import { Category, findCategory } from '../../../../core/routines/category';
import { RoutineBlock } from '../../../../core/routines/routine';
import { RoutinesStore } from '../../../../core/routines/routines-store';
import {
  NotTodayGroup,
  Task,
  TaskDraft,
  occursOn,
  repeatLabel,
} from '../../../../core/routines/task';
import { TasksStore } from '../../../../core/routines/tasks-store';
import { TaskForm } from '../task-form/task-form';

interface NotTodayView {
  readonly task: Task;
  readonly group: NotTodayGroup;
  readonly category?: Category;
  /** How often it repeats, or its day when it is a one-time task, e.g. "Oct 30". */
  readonly repeat: string;
}

const NOT_TODAY_GROUP_LABELS: Readonly<Record<NotTodayGroup, string>> = {
  scheduled: 'Scheduled',
  repeating: 'Other days',
  past: 'Past',
};

interface TaskView {
  readonly task: Task;
  readonly isDone: boolean;
  readonly category?: Category;
  /** How often it repeats, e.g. "Every day". */
  readonly repeat: string;
}

/**
 * The tasks card of the Today page: what is due today to check off, a form to add or edit a task,
 * and the tasks not due today, kept apart so they can still be edited or deleted.
 */
@Component({
  selector: 'app-today-tasks',
  imports: [TaskForm],
  templateUrl: './today-tasks.html',
  styleUrl: './today-tasks.css',
  host: { role: 'region', 'aria-labelledby': 'tasks-title' },
})
export class TodayTasks {
  private readonly store = inject(RoutinesStore);
  private readonly tasksStore = inject(TasksStore);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** The button the open task form came from, so the focus can go back to it. */
  private opener: HTMLElement | undefined;

  /** The current moment, which moves on with the clock; it decides what is due today. */
  readonly moment = input.required<Date>();
  /** The block picked on the timeline to filter the tasks by; none shows every task. */
  readonly selectedBlock = input<RoutineBlock | undefined>(undefined);
  /** Emits when the user asks to see every task again instead of the picked block's. */
  readonly showAll = output();

  protected readonly categories = this.store.categories;
  protected readonly weekday = computed(() => weekdayIndex(this.moment()));
  protected readonly todayIso = computed(() => isoDate(this.moment()));
  protected readonly isAddingTask = signal(false);
  /** Id of the task whose form is open for editing. */
  protected readonly editingTaskId = signal<string | undefined>(undefined);
  /** The task being edited as a list of at most one: tracked by id, so another task's form is rebuilt. */
  protected readonly editingTasks = computed(() =>
    this.tasksStore.tasks().filter((task) => task.id === this.editingTaskId()),
  );
  protected readonly isNotTodayOpen = signal(false);
  /** The task just added or edited out of today's list, so it can be found in "Not today". */
  protected readonly highlightedTaskId = signal<string | undefined>(undefined);
  protected readonly notTodayGroupLabels = NOT_TODAY_GROUP_LABELS;
  protected readonly notToday = computed(() =>
    this.tasksStore.notToday().map(({ task, group }): NotTodayView => ({
      task,
      group,
      category: this.categoryOf(task),
      repeat: repeatLabel(task, this.todayIso()),
    })),
  );
  protected readonly tasks = computed(() =>
    this.tasksStore
      .todayTasks()
      .filter(({ task }) => this.isRelatedToSelectedBlock(task))
      .map(({ task, isDone }): TaskView => ({
        task,
        isDone,
        category: this.categoryOf(task),
        repeat: repeatLabel(task, this.todayIso()),
      })),
  );
  protected readonly doneCount = computed(() => this.tasks().filter((item) => item.isDone).length);

  /** Tasks relate to a block through the category they share; with no block picked all of them do. */
  private isRelatedToSelectedBlock(task: Task): boolean {
    const block = this.selectedBlock();
    return block === undefined || task.categoryId === block.categoryId;
  }

  protected toggleTask(taskId: string): void {
    this.tasksStore.toggleDone(taskId);
  }

  protected startAddingTask(trigger: Event): void {
    this.editingTaskId.set(undefined);
    this.opener = trigger.currentTarget as HTMLElement;
    this.isAddingTask.set(!this.isAddingTask());
  }

  protected startEditingTask(taskId: string, trigger: Event): void {
    this.isAddingTask.set(false);
    this.opener = trigger.currentTarget as HTMLElement;
    this.editingTaskId.set(taskId);
  }

  protected closeTaskForm(): void {
    this.isAddingTask.set(false);
    this.editingTaskId.set(undefined);
    this.restoreFocus();
  }

  protected addTask(draft: TaskDraft): void {
    const task = this.tasksStore.addTask(draft);
    this.closeTaskForm();
    this.revealIfNotToday(task);
  }

  protected saveTask(taskId: string, draft: TaskDraft): void {
    const task = this.tasksStore.updateTask(taskId, draft);
    this.closeTaskForm();
    if (task !== undefined) this.revealIfNotToday(task);
  }

  protected deleteTask(taskId: string): void {
    if (this.editingTaskId() === taskId) this.editingTaskId.set(undefined);
    this.tasksStore.deleteTask(taskId);
  }

  /**
   * Puts the focus back where the form was opened from. If that button is gone (the task moved to
   * "Not today"), it goes to the "Not today" toggle, or the + button, so it never falls to the page.
   */
  private restoreFocus(): void {
    afterNextRender(
      () => {
        const host = this.host.nativeElement;
        const fallback =
          host.querySelector<HTMLElement>('.not-today-toggle') ??
          host.querySelector<HTMLElement>('[aria-label="New task"]');
        (this.opener?.isConnected ? this.opener : fallback)?.focus();
      },
      { injector: this.injector },
    );
  }

  /**
   * A task saved for another day leaves today's list at once, which would look like it was lost:
   * open "Not today" and mark it so it is easy to find.
   */
  private revealIfNotToday(task: Task): void {
    const isToday = occursOn(task, this.moment(), this.todayIso());
    this.highlightedTaskId.set(isToday ? undefined : task.id);
    if (!isToday) this.isNotTodayOpen.set(true);
  }

  private categoryOf(item: { readonly categoryId?: string }): Category | undefined {
    return findCategory(this.store.categories(), item.categoryId);
  }
}
