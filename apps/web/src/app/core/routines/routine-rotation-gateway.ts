import { Observable } from 'rxjs';
import { RoutineRotation } from './routine-rotation';

/**
 * Port to wherever the routine rotation is stored. `app.config.ts` binds it to the HTTP adapter and
 * tests to a fake.
 */
export abstract class RoutineRotationGateway {
  /** The saved rotation; one with no steps before the first save. */
  abstract get(): Observable<RoutineRotation>;

  /** Replaces the whole rotation; answers with the stored version (its start moved to a Monday). */
  abstract save(rotation: RoutineRotation): Observable<RoutineRotation>;
}
