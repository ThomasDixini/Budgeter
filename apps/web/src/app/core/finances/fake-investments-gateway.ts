import { Observable, of, throwError } from 'rxjs';
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

/**
 * 100 PETR4 bought at R$10.00 and now at R$12.00 (a 20% gain against 0.10% in the CDI), a dividend
 * received, and a fund with no price typed yet.
 */
export const SAMPLE_PORTFOLIO: Portfolio = {
  lines: [
    {
      investment: {
        id: 'petr4',
        name: 'PETR4',
        kind: 'stock',
        price: { cents: 1200, on: '2026-11-02' },
      },
      quantityThousandths: 100000,
      costCents: 100000,
      valueCents: 120000,
      gainCents: 20000,
      incomeCents: 1500,
    },
    {
      investment: { id: 'xpml11', name: 'XPML11', kind: 'realEstateFund' },
      quantityThousandths: 10000,
      costCents: 11000,
      incomeCents: 0,
    },
  ],
  totals: {
    costCents: 111000,
    valueCents: 131000,
    unpricedCount: 1,
    incomeCents: 1500,
    incomeLast12MonthsCents: 1500,
  },
  performance: {
    investedCents: 111000,
    gainCents: 21500,
    gainPercent: 19.37,
    cdiGainCents: 400,
    cdiPercent: 0.36,
    cdiThrough: '2026-11-03',
  },
  trades: [
    {
      id: 'buy-petr4',
      investmentId: 'petr4',
      date: '2026-10-05',
      kind: 'buy',
      quantityThousandths: 100000,
      unitPriceCents: 1000,
    },
    {
      id: 'buy-xpml11',
      investmentId: 'xpml11',
      date: '2026-10-20',
      kind: 'buy',
      quantityThousandths: 10000,
      unitPriceCents: 1100,
    },
  ],
  incomes: [
    {
      id: 'dividend-petr4',
      investmentId: 'petr4',
      date: '2026-10-28',
      kind: 'dividend',
      amountCents: 1500,
    },
  ],
};

/** Test double answering synchronously from memory; set `failure` to make the next calls fail. */
export class FakeInvestmentsGateway extends InvestmentsGateway {
  failure: Error | undefined;
  portfolioToServe: Portfolio = SAMPLE_PORTFOLIO;
  readonly savedInvestments: { id: string; draft: InvestmentDraft }[] = [];
  readonly deletedInvestments: string[] = [];
  readonly savedTrades: { id: string; draft: TradeDraft }[] = [];
  readonly deletedTrades: string[] = [];
  readonly savedIncomes: { id: string; draft: IncomeDraft }[] = [];
  readonly deletedIncomes: string[] = [];
  /** Days `portfolio` was asked for, in order. */
  readonly askedDays: string[] = [];

  override portfolio(asOf: string): Observable<Portfolio> {
    this.askedDays.push(asOf);
    return this.answer(this.portfolioToServe);
  }

  override saveInvestment(investmentId: string, draft: InvestmentDraft): Observable<Investment> {
    this.savedInvestments.push({ id: investmentId, draft });
    return this.answer({ id: investmentId, ...draft });
  }

  override deleteInvestment(investmentId: string): Observable<void> {
    this.deletedInvestments.push(investmentId);
    return this.answer(undefined);
  }

  override saveTrade(tradeId: string, draft: TradeDraft): Observable<Trade> {
    this.savedTrades.push({ id: tradeId, draft });
    return this.answer({ id: tradeId, ...draft });
  }

  override deleteTrade(tradeId: string): Observable<void> {
    this.deletedTrades.push(tradeId);
    return this.answer(undefined);
  }

  override saveIncome(incomeId: string, draft: IncomeDraft): Observable<Income> {
    this.savedIncomes.push({ id: incomeId, draft });
    return this.answer({ id: incomeId, ...draft });
  }

  override deleteIncome(incomeId: string): Observable<void> {
    this.deletedIncomes.push(incomeId);
    return this.answer(undefined);
  }

  private answer<TValue>(value: TValue): Observable<TValue> {
    return this.failure === undefined ? of(value) : throwError(() => this.failure);
  }
}
