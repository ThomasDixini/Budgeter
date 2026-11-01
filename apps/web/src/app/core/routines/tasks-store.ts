import { ErrorHandler, Injectable, computed, inject, signal } from '@angular/core';
import { Clock } from '../calendar/clock';
import { isoDate } from '../calendar/date-label';
import { Observable } from 'rxjs';
import { IdGenerator } from '../ids/id-generator';
import { CategoryCreations } from './category-creations';
import { Positioned, positionOf, restoredAt, sameId } from './list-positions';
import { NotTodayTask, Task, TaskDraft, occursOn, tasksNotToday } from './task';
import { TasksGateway } from './tasks-gateway';

/** A task on today's list and whether it is done today. */
export interface TodayTask {
  readonly task: Task;
  readonly isDone: boolean;
}

/**
 * Tasks of the Routines & Goals module and which ones are done today. Mutations apply locally
 * first and roll back if the gateway rejects them.
 */
@Injectable({ providedIn: 'root' })
export class TasksStore {
  private readonly gateway = inject(TasksGateway);
  private readonly ids = inject(IdGenerator);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly clock = inject(Clock);
  private readonly categoryCreations = inject(CategoryCreations);
  /**
   * The moment the list, the done marks and the checkboxes are all about. It moves only through
   * `followClock`, so the three always agree on the day, and a page left open past midnight moves on.
   */
  private readonly now = signal(this.clock.now());
  private readonly today = computed(() => isoDate(this.now()));
  private readonly taskList = signal<readonly Task[]>([]);
  private readonly doneToday = signal<ReadonlySet<string>>(new Set());

  readonly tasks = this.taskList.asReadonly();
  /** Tasks that show up today, in creation order. */
  readonly todayTasks = computed(() =>
    this.taskList()
      .filter((task) => occursOn(task, this.now(), this.today()))
      .map((task): TodayTask => ({ task, isDone: this.doneToday().has(task.id) })),
  );

  /** Tasks that are not due today (scheduled, repeating on other days, past), to edit or delete. */
  readonly notToday = computed((): NotTodayTask[] =>
    tasksNotToday(this.taskList(), this.now(), this.today()),
  );

  constructor() {
    this.gateway.list().subscribe({
      next: (tasks) => this.taskList.set(tasks),
      error: (error: unknown) => this.errorHandler.handleError(error),
    });
    this.loadDoneMarks(this.today());
  }

  /**
   * Moves on to the clock's day when it changed, e.g. on a page left open past midnight: today's list
   * and done marks become the new day's. Does nothing within the same day.
   * @example store.followClock()
   */
  followClock(): void {
    const moment = this.clock.now();
    if (isoDate(moment) === this.today()) return;
    this.now.set(moment);
    this.doneToday.set(new Set());
    this.loadDoneMarks(this.today());
  }

  private loadDoneMarks(isoDay: string): void {
    this.gateway.completedOn(isoDay).subscribe({
      // A slow answer for a day no longer shown must not mark this one's tasks.
      next: (taskIds) => {
        if (this.today() === isoDay) this.doneToday.set(new Set(taskIds));
      },
      error: (error: unknown) => this.errorHandler.handleError(error),
    });
  }

  /**
   * Adds a task; one that happens once is set for the day the draft names, or today. The server's
   * answer is not applied over the list (it only normalizes what the form already sends), so a slow
   * answer cannot overwrite an edit made to the task in the meantime.
   * @example store.addTask({ title: 'Call the bank', repeat: 'once', days: [] })
   */
  addTask(draft: TaskDraft): Task {
    const task: Task = { ...draft, id: this.ids.next(), date: this.dateFor(draft) };
    this.taskList.update((tasks) => [...tasks, task]);
    // Removed only while it is still the version added: an edit since then is the user's, and is
    // saved by its own request.
    const dropAdded = (): void =>
      this.taskList.update((tasks) => tasks.filter((current) => current !== task));
    this.saveOnceCategorySaved(task, dropAdded).subscribe({
      error: (error: unknown) => this.rejected(error, dropAdded),
    });
    return task;
  }

  /**
   * Edits a task in place: its title, category, repeat and day. It shows the change right away. A
   * failed save puts back the previous version only if this edit is still the one shown, so neither a
   * later edit of the same task nor an add or delete made in the meantime is undone; and the server's
   * answer is not applied over the list, so a slow answer cannot overwrite a newer edit.
   * @example store.updateTask('t3', { title: 'Do the LINQ exercises', repeat: 'daily', days: [] })
   */
  updateTask(taskId: string, draft: TaskDraft): Task | undefined {
    const previous = this.taskList().find((task) => task.id === taskId);
    if (previous === undefined) return undefined;
    const task: Task = { ...draft, id: taskId, date: this.dateFor(draft) };
    this.taskList.update((tasks) => replaceTask(tasks, task));
    const putPreviousBack = (): void =>
      this.taskList.update((tasks) =>
        tasks.map((current) => (current === task ? previous : current)),
      );
    this.saveOnceCategorySaved(task, putPreviousBack).subscribe({
      error: (error: unknown) => this.rejected(error, putPreviousBack),
    });
    return task;
  }

  /**
   * Saves the task, after its category when that is still being created (the API refuses a task of a
   * category it does not know yet); `undo` runs instead if the category could not be saved.
   */
  private saveOnceCategorySaved(task: Task, undo: () => void): Observable<Task> {
    return this.categoryCreations.whenSaved([task.categoryId], () => this.gateway.save(task), undo);
  }

  /**
   * Deletes a task and its history; puts it back in place if the gateway rejects it, keeping any task
   * added or deleted in the meantime.
   * @example store.deleteTask('t3')
   */
  deleteTask(taskId: string): void {
    const removed = positionOf(this.taskList(), (task) => task.id === taskId);
    this.removeTask(taskId);
    this.gateway.delete(taskId).subscribe({
      error: (error: unknown) => this.rejected(error, () => this.putBack(removed)),
    });
  }

  /**
   * Drops a deleted category from the tasks that used it. The API does the same; this keeps the list
   * from saving a task against a category that is gone. Returns how to give the category back to those
   * tasks, for when the deletion is rejected: a task given another category since keeps that one.
   * @example const reattach = store.detachCategory('languages');
   */
  detachCategory(categoryId: string): () => void {
    const detachedIds = this.taskList()
      .filter((task) => task.categoryId === categoryId)
      .map((task) => task.id);
    this.taskList.update((tasks) => withCategory(tasks, detachedIds, categoryId, undefined));
    return () =>
      this.taskList.update((tasks) => withCategory(tasks, detachedIds, undefined, categoryId));
  }

  /**
   * Flips a task between done and pending for today only; a repeating task starts pending again
   * on its next day.
   * @example store.toggleDone('t3')
   */
  toggleDone(taskId: string): void {
    const isDone = !this.doneToday().has(taskId);
    const day = this.today();
    this.markDone(taskId, isDone);
    this.gateway.setDone(taskId, day, isDone).subscribe({
      // The marks of another day are on screen once the day moved on; this one's are not to be touched.
      error: (error: unknown) =>
        this.rejected(error, () => {
          if (this.today() === day) this.markDone(taskId, !isDone);
        }),
    });
  }

  private dateFor(draft: TaskDraft): string | undefined {
    return draft.repeat === 'once' ? (draft.date ?? this.today()) : undefined;
  }

  private markDone(taskId: string, isDone: boolean): void {
    this.doneToday.update((done) => {
      const next = new Set(done);
      if (isDone) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  }

  private removeTask(taskId: string): void {
    this.taskList.update((tasks) => tasks.filter((task) => task.id !== taskId));
  }

  private putBack(removed: Positioned<Task> | undefined): void {
    if (removed !== undefined) this.taskList.update((tasks) => restoredAt(tasks, removed, sameId));
  }

  private rejected(error: unknown, rollback: () => void): void {
    rollback();
    this.errorHandler.handleError(error);
  }
}

function replaceTask(tasks: readonly Task[], saved: Task): Task[] {
  return tasks.map((task) => (task.id === saved.id ? saved : task));
}

/** The tasks with `to` as the category of the listed ones that still have `from`. */
function withCategory(
  tasks: readonly Task[],
  taskIds: readonly string[],
  from: string | undefined,
  to: string | undefined,
): Task[] {
  return tasks.map((task) =>
    taskIds.includes(task.id) && task.categoryId === from ? { ...task, categoryId: to } : task,
  );
}
