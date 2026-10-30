import { Observable } from 'rxjs';
import { Task } from './task';

/**
 * Port to wherever tasks and the days they were done are stored. The store depends on this class
 * only; `app.config.ts` binds it to the HTTP adapter and tests to a fake.
 */
export abstract class TasksGateway {
  /** Every task, in creation order. */
  abstract list(): Observable<readonly Task[]>;

  /** Creates or replaces a task; answers with the stored (normalized) version. */
  abstract save(task: Task): Observable<Task>;

  /** Deletes a task and its history; deleting one already gone succeeds. */
  abstract delete(taskId: string): Observable<void>;

  /** Ids of the tasks done on an ISO date. */
  abstract completedOn(isoDay: string): Observable<readonly string[]>;

  /** Marks or unmarks a task as done on an ISO date; repeating either is harmless. */
  abstract setDone(taskId: string, isoDay: string, isDone: boolean): Observable<void>;
}
