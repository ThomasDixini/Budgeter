import { Observable } from 'rxjs';
import { Goal } from './goal';

/**
 * Port to wherever goals and their progress are stored. The store depends on this class only;
 * `app.config.ts` binds it to the HTTP adapter and tests to a fake.
 */
export abstract class GoalsGateway {
  /** Every goal with its progress, in creation order. */
  abstract list(): Observable<readonly Goal[]>;

  /** Saves a goal built on the client; answers with the stored (normalized) version. */
  abstract create(goal: Goal): Observable<Goal>;

  /** Logs one more repetition or unit of progress; answers with the updated goal. */
  abstract logProgress(goalId: string): Observable<Goal>;
}
