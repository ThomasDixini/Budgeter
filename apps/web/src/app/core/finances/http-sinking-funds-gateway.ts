import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Bill } from './bills';
import { SinkingFund, SinkingFundDraft, SinkingFundsOverview } from './sinking-funds';
import { SinkingFundsGateway } from './sinking-funds-gateway';

const SINKING_FUNDS_URL = '/api/sinking-funds';

/** Sinking funds stored by the Orbit API. */
@Injectable()
export class HttpSinkingFundsGateway extends SinkingFundsGateway {
  private readonly httpClient = inject(HttpClient);

  override list(today: string): Observable<SinkingFundsOverview> {
    return this.httpClient.get<SinkingFundsOverview>(SINKING_FUNDS_URL, { params: { today } });
  }

  override save(id: string, today: string, draft: SinkingFundDraft): Observable<SinkingFund> {
    return this.httpClient.put<SinkingFund>(fundUrl(id), draft, { params: { today } });
  }

  override delete(id: string): Observable<void> {
    return this.httpClient.delete<void>(fundUrl(id));
  }

  override roll(today: string): Observable<readonly Bill[]> {
    return this.httpClient.post<readonly Bill[]>(`${SINKING_FUNDS_URL}/roll`, { today });
  }
}

function fundUrl(id: string): string {
  return `${SINKING_FUNDS_URL}/${encodeURIComponent(id)}`;
}
