import { Observable, of, throwError } from 'rxjs';
import { SAMPLE_TASKS } from './sample-routines';
import { Task } from './task';
import { TasksGateway } from './tasks-gateway';

/** Test double answering synchronously from memory; set `failure` to make the next calls fail. */
export class FakeTasksGateway extends TasksGateway {
  failure: Error | undefined;
  readonly saved: Task[] = [];
  readonly deleted: string[] = [];
  /** Calls to `setDone`, in order. */
  readonly doneChanges: {
    readonly taskId: string;
    readonly isoDay: string;
    readonly isDone: boolean;
  }[] = [];

  constructor(
    private readonly tasks: readonly Task[] = SAMPLE_TASKS,
    private readonly completed: readonly string[] = [],
  ) {
    super();
  }

  override list(): Observable<readonly Task[]> {
    return this.answer(this.tasks);
  }

  override save(task: Task): Observable<Task> {
    this.saved.push(task);
    return this.answer(task);
  }

  override delete(taskId: string): Observable<void> {
    this.deleted.push(taskId);
    return this.answer(undefined);
  }

  /** Days `completedOn` was asked for, in order. */
  readonly askedDays: string[] = [];
  /** Tasks done on given days, answered by `completedOn` for those days instead of the default ones. */
  readonly completedOnDay = new Map<string, readonly string[]>();

  override completedOn(isoDay: string): Observable<readonly string[]> {
    this.askedDays.push(isoDay);
    return this.answer(this.completedOnDay.get(isoDay) ?? this.completed);
  }

  override setDone(taskId: string, isoDay: string, isDone: boolean): Observable<void> {
    this.doneChanges.push({ taskId, isoDay, isDone });
    return this.answer(undefined);
  }

  private answer<TValue>(value: TValue): Observable<TValue> {
    return this.failure === undefined ? of(value) : throwError(() => this.failure);
  }
}
