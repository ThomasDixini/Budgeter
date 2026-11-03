import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  SAMPLE_ACCOUNTS,
  SAMPLE_FINANCE_CATEGORIES,
  SAMPLE_OCTOBER,
} from './fake-finances-gateways';
import { Account, FinanceCategory } from './finance-references';
import { HttpFinanceReferencesGateway, HttpTransactionsGateway } from './http-transactions-gateway';
import { Transaction } from './transaction';

const [GROCERIES] = SAMPLE_OCTOBER;

let httpTesting: HttpTestingController;

beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      HttpTransactionsGateway,
      HttpFinanceReferencesGateway,
    ],
  });
  httpTesting = TestBed.inject(HttpTestingController);
});

afterEach(() => httpTesting.verify());

describe('HttpTransactionsGateway', () => {
  it('lists the transactions of a month', () => {
    let received: readonly Transaction[] = [];

    TestBed.inject(HttpTransactionsGateway)
      .listMonth('2026-10')
      .subscribe((transactions) => (received = transactions));
    httpTesting
      .expectOne({ method: 'GET', url: '/api/transactions?month=2026-10' })
      .flush(SAMPLE_OCTOBER);

    expect(received).toEqual(SAMPLE_OCTOBER);
  });

  it('puts the transaction at its escaped id, without the id in the body', () => {
    TestBed.inject(HttpTransactionsGateway)
      .save({ ...GROCERIES, id: 'tx 1' })
      .subscribe();

    const request = httpTesting.expectOne({ method: 'PUT', url: '/api/transactions/tx%201' });
    const { id, ...body } = GROCERIES;
    expect([request.request.body, id]).toEqual([body, 'groceries']);
    request.flush(GROCERIES);
  });

  it('deletes a transaction', () => {
    TestBed.inject(HttpTransactionsGateway).delete('groceries').subscribe();

    httpTesting.expectOne({ method: 'DELETE', url: '/api/transactions/groceries' }).flush(null);
  });
});

describe('HttpFinanceReferencesGateway', () => {
  it('lists the finance categories', () => {
    let received: readonly FinanceCategory[] = [];

    TestBed.inject(HttpFinanceReferencesGateway)
      .categories()
      .subscribe((categories) => (received = categories));
    httpTesting
      .expectOne({ method: 'GET', url: '/api/finance-categories' })
      .flush(SAMPLE_FINANCE_CATEGORIES);

    expect(received).toEqual(SAMPLE_FINANCE_CATEGORIES);
  });

  it('lists the accounts', () => {
    let received: readonly Account[] = [];

    TestBed.inject(HttpFinanceReferencesGateway)
      .accounts()
      .subscribe((accounts) => (received = accounts));
    httpTesting.expectOne({ method: 'GET', url: '/api/accounts' }).flush(SAMPLE_ACCOUNTS);

    expect(received).toEqual(SAMPLE_ACCOUNTS);
  });
});
