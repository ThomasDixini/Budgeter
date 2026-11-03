import { ErrorHandler, Injectable, computed, inject, signal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { Clock } from '../calendar/clock';
import { isoDate } from '../calendar/date-label';
import { IdGenerator } from '../ids/id-generator';
import { IncomeDraft, InvestmentDraft, Portfolio, TradeDraft, movements } from './investments';
import { InvestmentsGateway } from './investments-gateway';

/**
 * What the Investments page shows: the portfolio worked out by the API, with the trades and proventos
 * behind it. Provided by the page, so each visit loads fresh data. Every figure comes from the API, so a
 * change is sent first and the portfolio is read again once it is stored; the methods say whether it was
 * (a refusal, like selling more than was held, is reported and leaves the form open).
 */
@Injectable()
export class InvestmentsStore {
  private readonly gateway = inject(InvestmentsGateway);
  private readonly ids = inject(IdGenerator);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly current = signal<Portfolio | undefined>(undefined);
  private readonly loadFailed = signal(false);
  private readonly saving = signal(false);
  /** Counts portfolio requests, so an answer overtaken by a newer one is dropped. */
  private request = 0;

  /** Today, `YYYY-MM-DD`: the portfolio is valued and compared with the CDI up to it. */
  readonly today = isoDate(inject(Clock).now());
  readonly portfolio = this.current.asReadonly();
  readonly isLoaded = computed(() => this.current() !== undefined);
  readonly hasLoadFailed = this.loadFailed.asReadonly();
  /** Whether a change is on its way to the API. */
  readonly isSaving = this.saving.asReadonly();
  readonly movements = computed(() => {
    const portfolio = this.current();
    if (portfolio === undefined) return [];
    const names = new Map(
      portfolio.lines.map((line) => [line.investment.id, line.investment.name]),
    );
    return movements(portfolio, names);
  });

  constructor() {
    void this.refresh();
  }

  /**
   * Loads again, after a failed load.
   * @example store.reload()
   */
  reload(): void {
    this.loadFailed.set(false);
    void this.refresh();
  }

  /** @example await store.saveInvestment(undefined, { name: 'PETR4', kind: 'stock' }) */
  saveInvestment(investmentId: string | undefined, draft: InvestmentDraft): Promise<boolean> {
    return this.write(this.gateway.saveInvestment(investmentId ?? this.ids.next(), draft));
  }

  /** @example await store.deleteInvestment('petr4') */
  deleteInvestment(investmentId: string): Promise<boolean> {
    return this.write(this.gateway.deleteInvestment(investmentId));
  }

  /** @example await store.addTrade({ investmentId: 'petr4', date: '2026-11-03', kind: 'buy', quantityThousandths: 100000, unitPriceCents: 3845 }) */
  addTrade(draft: TradeDraft): Promise<boolean> {
    return this.write(this.gateway.saveTrade(this.ids.next(), draft));
  }

  /** @example await store.deleteTrade('buy-petr4') */
  deleteTrade(tradeId: string): Promise<boolean> {
    return this.write(this.gateway.deleteTrade(tradeId));
  }

  /** @example await store.addIncome({ investmentId: 'petr4', date: '2026-11-03', kind: 'dividend', amountCents: 1500 }) */
  addIncome(draft: IncomeDraft): Promise<boolean> {
    return this.write(this.gateway.saveIncome(this.ids.next(), draft));
  }

  /** @example await store.deleteIncome('dividend-petr4') */
  deleteIncome(incomeId: string): Promise<boolean> {
    return this.write(this.gateway.deleteIncome(incomeId));
  }

  private async write(change: Observable<unknown>): Promise<boolean> {
    this.saving.set(true);
    try {
      await firstValueFrom(change, { defaultValue: undefined });
    } catch (error) {
      this.errorHandler.handleError(error);
      return false;
    } finally {
      this.saving.set(false);
    }
    await this.refresh();
    return true;
  }

  private async refresh(): Promise<void> {
    const request = ++this.request;
    try {
      const portfolio = await firstValueFrom(this.gateway.portfolio(this.today));
      if (request === this.request) this.current.set(portfolio);
    } catch (error) {
      if (request !== this.request) return;
      this.loadFailed.set(true);
      this.errorHandler.handleError(error);
    }
  }
}
