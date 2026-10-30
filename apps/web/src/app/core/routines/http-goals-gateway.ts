import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Goal, GoalChanges } from './goal';
import { GoalsGateway } from './goals-gateway';

const GOALS_URL = '/api/goals';

/** Goals stored by the Budgeter API. */
@Injectable()
export class HttpGoalsGateway extends GoalsGateway {
  private readonly httpClient = inject(HttpClient);

  override list(isoDay: string): Observable<readonly Goal[]> {
    return this.httpClient.get<readonly Goal[]>(GOALS_URL, { params: { date: isoDay } });
  }

  override create(goal: Goal, isoDay: string): Observable<Goal> {
    return this.httpClient.post<Goal>(GOALS_URL, goal, { params: { date: isoDay } });
  }

  override update(goalId: string, changes: GoalChanges, isoDay: string): Observable<Goal> {
    return this.httpClient.put<Goal>(goalUrl(goalId), changes, { params: { date: isoDay } });
  }

  override delete(goalId: string): Observable<void> {
    return this.httpClient.delete<void>(goalUrl(goalId));
  }

  override setAchievement(goalId: string, isoDay: string, isAchieved: boolean): Observable<Goal> {
    return this.httpClient.put<Goal>(`${goalUrl(goalId)}/achievement`, {
      date: isoDay,
      achieved: isAchieved,
    });
  }
}

function goalUrl(goalId: string): string {
  return `${GOALS_URL}/${encodeURIComponent(goalId)}`;
}
