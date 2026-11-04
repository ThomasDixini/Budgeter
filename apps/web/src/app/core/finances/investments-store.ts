import { ErrorHandler, Injectable, computed, inject, signal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { Clock } from '../calendar/clock';
import { isoDate } from '../calendar/date-label';
import { IdGenerator } from '../ids/id-generator';
import { ImportBatch } from './investment-import';
import { IncomeDraft, InvestmentDraft, Portfolio, TradeDraft, movements } from './investments';
import { InvestmentsGateway } from './investments-gateway';

/** How many proventos of an import are sent at the same time. */
const IMPORT_BATCH_SIZE = 8;

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

  /**
   * Writes what a file import brought: the new investments first, then the trades from the oldest (a sale
   * is refused when written before the purchase behind it), then the proventos a few at a time. A refusal
   * is reported and counted, and the rest still go through. The portfolio is read once at the end.
   * @example await store.importBatch(batch) // { saved: 40, failed: 0 }
   */
  async importBatch(batch: ImportBatch): Promise<{ saved: number; failed: number }> {
    this.saving.set(true);
    let failed = 0;
    try {
      const count = async (writes: readonly Observable<unknown>[]): Promise<void> => {
        const results = await Promise.all(writes.map((write) => this.tryToWrite(write)));
        failed += results.filter((isDone) => !isDone).length;
      };
      await count(
        batch.investments.map((item) => this.gateway.saveInvestment(item.id, item.draft)),
      );
      for (const item of batch.trades) await count([this.gateway.saveTrade(item.id, item.draft)]);
      for (let start = 0; start < batch.incomes.length; start += IMPORT_BATCH_SIZE) {
        const incomes = batch.incomes.slice(start, start + IMPORT_BATCH_SIZE);
        await count(incomes.map((item) => this.gateway.saveIncome(item.id, item.draft)));
      }
    } finally {
      this.saving.set(false);
    }
    await this.refresh();
    const total = batch.investments.length + batch.trades.length + batch.incomes.length;
    return { saved: total - failed, failed };
  }

  private async tryToWrite(change: Observable<unknown>): Promise<boolean> {
    try {
      await firstValueFrom(change, { defaultValue: undefined });
      return true;
    } catch (error) {
      this.errorHandler.handleError(error);
      return false;
    }
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
