import { ErrorHandler, Injectable, computed, inject, signal } from '@angular/core';
import { Clock } from '../calendar/clock';
import { isoDate } from '../calendar/date-label';
import { IdGenerator } from '../ids/id-generator';
import { Task, TaskDraft, occursOn } from './task';
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
  private readonly now = inject(Clock).now();
  private readonly today = isoDate(this.now);
  private readonly taskList = signal<readonly Task[]>([]);
  private readonly doneToday = signal<ReadonlySet<string>>(new Set());

  readonly tasks = this.taskList.asReadonly();
  /** Tasks that show up today, in creation order. */
  readonly todayTasks = computed(() =>
    this.taskList()
      .filter((task) => occursOn(task, this.now, this.today))
      .map((task): TodayTask => ({ task, isDone: this.doneToday().has(task.id) })),
  );

  constructor() {
    this.gateway.list().subscribe({
      next: (tasks) => this.taskList.set(tasks),
      error: (error: unknown) => this.errorHandler.handleError(error),
    });
    this.gateway.completedOn(this.today).subscribe({
      next: (taskIds) => this.doneToday.set(new Set(taskIds)),
      error: (error: unknown) => this.errorHandler.handleError(error),
    });
  }

  /**
   * Adds a task; one that happens once is set for today.
   * @example store.addTask({ title: 'Call the bank', repeat: 'once', days: [] })
   */
  addTask(draft: TaskDraft): Task {
    const task: Task = { ...draft, id: this.ids.next(), date: this.dateFor(draft) };
    this.taskList.update((tasks) => [...tasks, task]);
    this.gateway.save(task).subscribe({
      next: (saved) => this.taskList.update((tasks) => replaceTask(tasks, saved)),
      error: (error: unknown) => this.rejected(error, () => this.removeTask(task.id)),
    });
    return task;
  }

  /**
   * Deletes a task and its history; puts it back in place if the gateway rejects it.
   * @example store.deleteTask('t3')
   */
  deleteTask(taskId: string): void {
    const before = this.taskList();
    this.removeTask(taskId);
    this.gateway.delete(taskId).subscribe({
      error: (error: unknown) => this.rejected(error, () => this.taskList.set(before)),
    });
  }

  /**
   * Flips a task between done and pending for today only; a repeating task starts pending again
   * on its next day.
   * @example store.toggleDone('t3')
   */
  toggleDone(taskId: string): void {
    const isDone = !this.doneToday().has(taskId);
    this.markDone(taskId, isDone);
    this.gateway.setDone(taskId, this.today, isDone).subscribe({
      error: (error: unknown) => this.rejected(error, () => this.markDone(taskId, !isDone)),
    });
  }

  private dateFor(draft: TaskDraft): string | undefined {
    return draft.repeat === 'once' ? (draft.date ?? this.today) : undefined;
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

  private rejected(error: unknown, rollback: () => void): void {
    rollback();
    this.errorHandler.handleError(error);
  }
}

function replaceTask(tasks: readonly Task[], saved: Task): Task[] {
  return tasks.map((task) => (task.id === saved.id ? saved : task));
}
