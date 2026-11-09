import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Account, FinanceCategory } from './finance-references';
import { Transaction } from './transaction';
import { FinanceReferencesGateway, TransactionsGateway } from './transactions-gateway';

const TRANSACTIONS_URL = '/api/transactions';
const ACCOUNTS_URL = '/api/accounts';
const CATEGORIES_URL = '/api/finance-categories';

/** Transactions stored by the Orbit API. */
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

/** Finance categories and accounts served by the Orbit API. */
@Injectable()
export class HttpFinanceReferencesGateway extends FinanceReferencesGateway {
  private readonly httpClient = inject(HttpClient);

  override categories(): Observable<readonly FinanceCategory[]> {
    return this.httpClient.get<readonly FinanceCategory[]>(CATEGORIES_URL);
  }

  override saveCategory(category: FinanceCategory): Observable<FinanceCategory> {
    // The id travels in the URL only, as the API reads it from there.
    const { id, ...body } = category;
    return this.httpClient.put<FinanceCategory>(categoryUrl(id), body);
  }

  override deleteCategory(categoryId: string): Observable<void> {
    return this.httpClient.delete<void>(categoryUrl(categoryId));
  }

  override accounts(): Observable<readonly Account[]> {
    return this.httpClient.get<readonly Account[]>(ACCOUNTS_URL);
  }

  override saveAccount(account: Account): Observable<Account> {
    // The id travels in the URL only, as the API reads it from there.
    const { id, ...body } = account;
    return this.httpClient.put<Account>(accountUrl(id), body);
  }

  override deleteAccount(accountId: string): Observable<void> {
    return this.httpClient.delete<void>(accountUrl(accountId));
  }
}

function transactionUrl(transactionId: string): string {
  return `${TRANSACTIONS_URL}/${encodeURIComponent(transactionId)}`;
}

function categoryUrl(categoryId: string): string {
  return `${CATEGORIES_URL}/${encodeURIComponent(categoryId)}`;
}

function accountUrl(accountId: string): string {
  return `${ACCOUNTS_URL}/${encodeURIComponent(accountId)}`;
}
