import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Bill, BillDraft, BillSettlement, BillsAgenda } from './bills';
import { BillsGateway } from './bills-gateway';

const BILLS_URL = '/api/bills';

/** Bills stored by the Orbit API. */
@Injectable()
export class HttpBillsGateway extends BillsGateway {
  private readonly httpClient = inject(HttpClient);

  override agenda(asOf: string): Observable<BillsAgenda> {
    return this.httpClient.get<BillsAgenda>(BILLS_URL, { params: { date: asOf } });
  }

  override save(billId: string, draft: BillDraft): Observable<readonly Bill[]> {
    const { repeat, ...bill } = draft;
    // The API names the field "recurrence" and reads the id from the URL only.
    return this.httpClient.put<readonly Bill[]>(billUrl(billId), { ...bill, recurrence: repeat });
  }

  override delete(billId: string): Observable<void> {
    return this.httpClient.delete<void>(billUrl(billId));
  }

  override settle(billId: string, settlement: BillSettlement): Observable<Bill> {
    return this.httpClient.put<Bill>(`${billUrl(billId)}/settlement`, settlement);
  }

  override reopen(billId: string): Observable<Bill> {
    return this.httpClient.delete<Bill>(`${billUrl(billId)}/settlement`);
  }
}

function billUrl(billId: string): string {
  return `${BILLS_URL}/${encodeURIComponent(billId)}`;
}
