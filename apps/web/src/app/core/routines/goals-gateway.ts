import { Observable } from 'rxjs';
import { Goal, GoalChanges } from './goal';

/** One manual entry of a goal's progress log. */
export interface ProgressEntry {
  /** Chosen by the client; sending the same one again counts once. */
  readonly eventId: string;
  /** The local day (`YYYY-MM-DD`) the entry counts for. */
  readonly isoDay: string;
  /** 1 to log a repetition, -1 to take one back. */
  readonly amount: number;
}

/**
 * Port to wherever goals and their progress are stored. The store depends on this class only;
 * `app.config.ts` binds it to the HTTP adapter and tests to a fake. Progress is always the one of
 * the period around the given day, so a new week starts at zero without anything being reset.
 */
export abstract class GoalsGateway {
  /** Every goal with its progress in the period around `isoDay`, in creation order. */
  abstract list(isoDay: string): Observable<readonly Goal[]>;

  /** Saves a goal built on the client; answers with the stored (normalized) version. */
  abstract create(goal: Goal, isoDay: string): Observable<Goal>;

  /** Edits a goal (not its type or category); answers with the stored version. */
  abstract update(goalId: string, changes: GoalChanges, isoDay: string): Observable<Goal>;

  /** Deletes a goal and its progress; deleting one already gone succeeds. */
  abstract delete(goalId: string): Observable<void>;

  /** Logs or takes back one repetition; answers with the goal and its updated progress. */
  abstract logProgress(goalId: string, entry: ProgressEntry): Observable<Goal>;
}
