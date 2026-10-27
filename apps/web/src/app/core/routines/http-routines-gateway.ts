import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Routine } from './routine';
import { RoutinesGateway } from './routines-gateway';

const ROUTINES_URL = '/api/routines';

/** Routines stored by the Budgeter API. */
@Injectable()
export class HttpRoutinesGateway extends RoutinesGateway {
  private readonly httpClient = inject(HttpClient);

  override list(): Observable<readonly Routine[]> {
    return this.httpClient.get<readonly Routine[]>(ROUTINES_URL);
  }

  override save(routine: Routine): Observable<Routine> {
    return this.httpClient.put<Routine>(
      `${ROUTINES_URL}/${encodeURIComponent(routine.id)}`,
      routine,
    );
  }
}
