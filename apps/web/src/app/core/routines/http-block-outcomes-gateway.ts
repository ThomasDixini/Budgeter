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
    return this.httpClient.put<BlockOutcome>(
      outcomeUrl(isoDay, outcome.routineId, outcome.blockId),
      { outcome: outcome.outcome, at: outcome.at },
    );
  }

  override undo(isoDay: string, routineId: string, blockId: string): Observable<void> {
    return this.httpClient.delete<void>(outcomeUrl(isoDay, routineId, blockId));
  }
}

function outcomeUrl(isoDay: string, routineId: string, blockId: string): string {
  const path = [routineId, 'days', isoDay, 'blocks', blockId].map(encodeURIComponent).join('/');
  return `/api/routines/${path}`;
}
