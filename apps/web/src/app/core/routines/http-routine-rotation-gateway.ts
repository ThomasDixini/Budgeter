import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { RoutineRotation } from './routine-rotation';
import { RoutineRotationGateway } from './routine-rotation-gateway';

const ROUTINE_ROTATION_URL = '/api/routine-rotation';

/** The routine rotation stored by the Budgeter API. */
@Injectable()
export class HttpRoutineRotationGateway extends RoutineRotationGateway {
  private readonly httpClient = inject(HttpClient);

  override get(): Observable<RoutineRotation> {
    return this.httpClient.get<RoutineRotation>(ROUTINE_ROTATION_URL);
  }

  override save(rotation: RoutineRotation): Observable<RoutineRotation> {
    return this.httpClient.put<RoutineRotation>(ROUTINE_ROTATION_URL, rotation);
  }
}
