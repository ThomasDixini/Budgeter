import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Goal } from './goal';
import { GoalsGateway } from './goals-gateway';

const GOALS_URL = '/api/goals';

/** Goals stored by the Budgeter API. */
@Injectable()
export class HttpGoalsGateway extends GoalsGateway {
  private readonly httpClient = inject(HttpClient);

  override list(): Observable<readonly Goal[]> {
    return this.httpClient.get<readonly Goal[]>(GOALS_URL);
  }

  override create(goal: Goal): Observable<Goal> {
    return this.httpClient.post<Goal>(GOALS_URL, goal);
  }

  override logProgress(goalId: string): Observable<Goal> {
    return this.httpClient.post<Goal>(`${GOALS_URL}/${encodeURIComponent(goalId)}/progress`, null);
  }
}
