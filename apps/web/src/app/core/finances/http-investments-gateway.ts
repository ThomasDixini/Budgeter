import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  Income,
  IncomeDraft,
  Investment,
  InvestmentDraft,
  Portfolio,
  Trade,
  TradeDraft,
} from './investments';
import { InvestmentsGateway } from './investments-gateway';
import { placeholderHistory } from './placeholder-history';

const INVESTMENTS_URL = '/api/investments';
const TRADES_URL = '/api/investment-trades';
const INCOMES_URL = '/api/investment-incomes';

/** Investments stored by the Budgeter API. */
@Injectable()
export class HttpInvestmentsGateway extends InvestmentsGateway {
  private readonly httpClient = inject(HttpClient);

  override portfolio(asOf: string): Observable<Portfolio> {
    // PLACEHOLDER: the API sends no month-end history yet, so made-up points fill the history charts.
    return this.httpClient
      .get<Portfolio>(INVESTMENTS_URL, { params: { date: asOf } })
      .pipe(map((portfolio) => ({ ...portfolio, history: placeholderHistory(portfolio, asOf) })));
  }

  override saveInvestment(investmentId: string, draft: InvestmentDraft): Observable<Investment> {
    return this.httpClient.put<Investment>(urlOf(INVESTMENTS_URL, investmentId), draft);
  }

  override deleteInvestment(investmentId: string): Observable<void> {
    return this.httpClient.delete<void>(urlOf(INVESTMENTS_URL, investmentId));
  }

  override saveTrade(tradeId: string, draft: TradeDraft): Observable<Trade> {
    return this.httpClient.put<Trade>(urlOf(TRADES_URL, tradeId), draft);
  }

  override deleteTrade(tradeId: string): Observable<void> {
    return this.httpClient.delete<void>(urlOf(TRADES_URL, tradeId));
  }

  override saveIncome(incomeId: string, draft: IncomeDraft): Observable<Income> {
    return this.httpClient.put<Income>(urlOf(INCOMES_URL, incomeId), draft);
  }

  override deleteIncome(incomeId: string): Observable<void> {
    return this.httpClient.delete<void>(urlOf(INCOMES_URL, incomeId));
  }
}

function urlOf(base: string, id: string): string {
  return `${base}/${encodeURIComponent(id)}`;
}
