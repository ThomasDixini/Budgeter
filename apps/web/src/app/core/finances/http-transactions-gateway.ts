import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Account, FinanceCategory } from './finance-references';
import { Transaction } from './transaction';
import { FinanceReferencesGateway, TransactionsGateway } from './transactions-gateway';

const TRANSACTIONS_URL = '/api/transactions';

/** Transactions stored by the Budgeter API. */
@Injectable()
export class HttpTransactionsGateway extends TransactionsGateway {
  private readonly httpClient = inject(HttpClient);

  override listMonth(month: string): Observable<readonly Transaction[]> {
    return this.httpClient.get<readonly Transaction[]>(TRANSACTIONS_URL, { params: { month } });
  }

  override save(transaction: Transaction): Observable<Transaction> {
    // The id travels in the URL only, as the API reads it from there.
    const { id, ...body } = transaction;
    return this.httpClient.put<Transaction>(transactionUrl(id), body);
  }

  override delete(transactionId: string): Observable<void> {
    return this.httpClient.delete<void>(transactionUrl(transactionId));
  }
}

/** Finance categories and accounts served by the Budgeter API. */
@Injectable()
export class HttpFinanceReferencesGateway extends FinanceReferencesGateway {
  private readonly httpClient = inject(HttpClient);

  override categories(): Observable<readonly FinanceCategory[]> {
    return this.httpClient.get<readonly FinanceCategory[]>('/api/finance-categories');
  }

  override accounts(): Observable<readonly Account[]> {
    return this.httpClient.get<readonly Account[]>('/api/accounts');
  }
}

function transactionUrl(transactionId: string): string {
  return `${TRANSACTIONS_URL}/${encodeURIComponent(transactionId)}`;
}
