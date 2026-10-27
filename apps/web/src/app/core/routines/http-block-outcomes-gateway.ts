import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BlockOutcomesGateway } from './block-outcomes-gateway';
import { BlockOutcome } from './day-plan';

/** Block outcomes stored by the Budgeter API. */
@Injectable()
export class HttpBlockOutcomesGateway extends BlockOutcomesGateway {
  private readonly httpClient = inject(HttpClient);

  override list(isoDay: string): Observable<readonly BlockOutcome[]> {
    return this.httpClient.get<readonly BlockOutcome[]>('/api/block-outcomes', {
      params: { date: isoDay },
    });
  }

  override record(isoDay: string, outcome: BlockOutcome): Observable<BlockOutcome> {
    const path = [outcome.routineId, 'days', isoDay, 'blocks', outcome.blockId]
      .map(encodeURIComponent)
      .join('/');
    return this.httpClient.put<BlockOutcome>(`/api/routines/${path}`, {
      outcome: outcome.outcome,
      at: outcome.at,
    });
  }
}
