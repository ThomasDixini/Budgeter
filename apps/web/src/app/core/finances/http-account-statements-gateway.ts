import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AccountStatement, CardPayment } from './account-statement';
import { AccountStatementsGateway } from './account-statements-gateway';

const CARD_PAYMENTS_URL = '/api/card-payments';

/** Account statements and card payments served by the Orbit API. */
@Injectable()
export class HttpAccountStatementsGateway extends AccountStatementsGateway {
  private readonly httpClient = inject(HttpClient);

  override statements(asOf: string): Observable<readonly AccountStatement[]> {
    return this.httpClient.get<readonly AccountStatement[]>('/api/account-statements', {
      params: { date: asOf },
    });
  }

  override paymentsInMonth(month: string): Observable<readonly CardPayment[]> {
    return this.httpClient.get<readonly CardPayment[]>(CARD_PAYMENTS_URL, { params: { month } });
  }

  override savePayment(payment: CardPayment): Observable<CardPayment> {
    // The id travels in the URL only, as the API reads it from there.
    const { id, ...body } = payment;
    return this.httpClient.put<CardPayment>(paymentUrl(id), body);
  }

  override deletePayment(paymentId: string): Observable<void> {
    return this.httpClient.delete<void>(paymentUrl(paymentId));
  }
}

function paymentUrl(paymentId: string): string {
  return `${CARD_PAYMENTS_URL}/${encodeURIComponent(paymentId)}`;
}
