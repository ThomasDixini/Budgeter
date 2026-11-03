import { Observable } from 'rxjs';
import {
  Income,
  IncomeDraft,
  Investment,
  InvestmentDraft,
  Portfolio,
  Trade,
  TradeDraft,
} from './investments';

/**
 * Port to wherever investments are stored and the portfolio is worked out. `app.config.ts` binds it to
 * the HTTP adapter and tests to a fake.
 */
export abstract class InvestmentsGateway {
  /** The portfolio as of a `YYYY-MM-DD` day, with the trades and proventos behind it. */
  abstract portfolio(asOf: string): Observable<Portfolio>;

  abstract saveInvestment(investmentId: string, draft: InvestmentDraft): Observable<Investment>;

  /** Deleting an investment with trades or proventos is refused. */
  abstract deleteInvestment(investmentId: string): Observable<void>;

  /** Selling more than was held is refused. */
  abstract saveTrade(tradeId: string, draft: TradeDraft): Observable<Trade>;

  abstract deleteTrade(tradeId: string): Observable<void>;

  abstract saveIncome(incomeId: string, draft: IncomeDraft): Observable<Income>;

  abstract deleteIncome(incomeId: string): Observable<void>;
}
