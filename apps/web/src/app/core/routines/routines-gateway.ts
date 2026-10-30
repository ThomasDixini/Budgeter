import { Observable } from 'rxjs';
import { Routine } from './routine';

/**
 * Port to wherever routines and their blocks are stored. The store depends on this class only;
 * `app.config.ts` binds it to the HTTP adapter and tests to a fake.
 */
export abstract class RoutinesGateway {
  /** Every routine with its blocks, in creation order. */
  abstract list(): Observable<readonly Routine[]>;

  /** Creates or replaces the routine as a whole; answers with the stored (normalized) version. */
  abstract save(routine: Routine): Observable<Routine>;

  /** Deletes the routine and its blocks; deleting one already gone succeeds. */
  abstract delete(routineId: string): Observable<void>;
}
