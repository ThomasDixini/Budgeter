import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { IncomeSplit } from './income-split';
import { IncomeSplitGateway } from './income-split-gateway';

const INCOME_SPLIT_URL = '/api/income-split';

/** The income split stored by the Budgeter API. */
@Injectable()
export class HttpIncomeSplitGateway extends IncomeSplitGateway {
  private readonly httpClient = inject(HttpClient);

  override get(): Observable<IncomeSplit> {
    return this.httpClient.get<IncomeSplit>(INCOME_SPLIT_URL);
  }

  override save(split: IncomeSplit): Observable<IncomeSplit> {
    return this.httpClient.put<IncomeSplit>(INCOME_SPLIT_URL, split);
  }
}
