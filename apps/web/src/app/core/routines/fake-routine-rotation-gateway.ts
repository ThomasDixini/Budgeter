import { Observable, of, throwError } from 'rxjs';
import { NO_ROTATION, RoutineRotation } from './routine-rotation';
import { RoutineRotationGateway } from './routine-rotation-gateway';

/** Test double answering synchronously from memory; set `failure` to make the next calls fail. */
export class FakeRoutineRotationGateway extends RoutineRotationGateway {
  failure: Error | undefined;
  readonly saved: RoutineRotation[] = [];

  constructor(private stored: RoutineRotation = NO_ROTATION) {
    super();
  }

  override get(): Observable<RoutineRotation> {
    return this.answer(this.stored);
  }

  override save(rotation: RoutineRotation): Observable<RoutineRotation> {
    if (this.failure === undefined) {
      this.saved.push(rotation);
      this.stored = rotation;
    }
    return this.answer(rotation);
  }

  private answer<TValue>(value: TValue): Observable<TValue> {
    return this.failure === undefined ? of(value) : throwError(() => this.failure);
  }
}
