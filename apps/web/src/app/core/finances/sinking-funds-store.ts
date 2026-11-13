import { ErrorHandler, Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, of, switchMap } from 'rxjs';
import { Clock } from '../calendar/clock';
import { isoDate } from '../calendar/date-label';
import { IdGenerator } from '../ids/id-generator';
import { Bill } from './bills';
import { SinkingFund, SinkingFundDraft, SinkingFundsOverview } from './sinking-funds';
import { SinkingFundsGateway } from './sinking-funds-gateway';

/**
 * The sinking funds on the "To pay & receive" page. Provided by the page: opening it rolls the funds
 * that fall due into bills, then reads the list. Not optimistic, because the saved and monthly amounts
 * are calculated by the API; the screen follows the refreshed list.
 */
@Injectable()
export class SinkingFundsStore {
  private readonly gateway = inject(SinkingFundsGateway);
  private readonly ids = inject(IdGenerator);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly fundList = signal<readonly SinkingFund[]>([]);
  private readonly total = signal(0);
  private readonly loaded = signal(false);
  private readonly loadFailed = signal(false);
  private readonly actionFailed = signal(false);
  private readonly rolled = signal<readonly Bill[]>([]);
  private readonly saves = signal(0);
  /** Counts list requests, so an answer overtaken by a newer one is dropped. */
  private listRequest = 0;

  /** Today, `YYYY-MM-DD`: funds are rolled and their schedules read from it. */
  readonly today = isoDate(inject(Clock).now());
  readonly funds = this.fundList.asReadonly();
  readonly totalMonthlyCents = this.total.asReadonly();
  readonly isLoaded = this.loaded.asReadonly();
  readonly hasLoadFailed = this.loadFailed.asReadonly();
  readonly hasActionFailed = this.actionFailed.asReadonly();
  /** Bills the roll created on load. */
  readonly rolledBills = this.rolled.asReadonly();
  /** How many saves the API has accepted; a form waits for it to grow to know its save went through. */
  readonly savedCount = this.saves.asReadonly();

  constructor() {
    this.load();
  }

  /**
   * Loads again after a failed load.
   * @example store.reload()
   */
  reload(): void {
    this.loadFailed.set(false);
    this.load();
  }

  /**
   * Creates a fund (a new id is generated when none is given) or replaces the one with that id.
   * @example store.save({ description: 'IPVA', categoryId: 'transport', amountCents: 120000, schedule: { kind: 'fixedDate', month: 1, day: 15 } })
   */
  save(draft: SinkingFundDraft, id?: string): void {
    const fundId = id ?? this.ids.next();
    this.change(this.gateway.save(fundId, this.today, draft), () =>
      this.saves.update((count) => count + 1),
    );
  }

  /**
   * Deletes a fund.
   * @example store.remove('ipva')
   */
  remove(id: string): void {
    this.change(this.gateway.delete(id));
  }

  private change(request: Observable<unknown>, onAccepted?: () => void): void {
    this.actionFailed.set(false);
    request.subscribe({
      next: () => {
        onAccepted?.();
        this.refresh();
      },
      error: (error: unknown) => this.failAction(error),
    });
  }

  private failAction(error: unknown): void {
    this.actionFailed.set(true);
    this.errorHandler.handleError(error);
  }

  // A failed roll must not hide the funds: it is retried on the next visit.
  private load(): void {
    const request = ++this.listRequest;
    this.gateway
      .roll(this.today)
      .pipe(
        catchError((error: unknown) => {
          this.errorHandler.handleError(error);
          return of<readonly Bill[]>([]);
        }),
        switchMap((bills) => {
          this.rolled.set(bills);
          return this.gateway.list(this.today);
        }),
      )
      .subscribe(this.listObserver(request));
  }

  private refresh(): void {
    const request = ++this.listRequest;
    this.gateway.list(this.today).subscribe(this.listObserver(request));
  }

  private listObserver(request: number): {
    next: (overview: SinkingFundsOverview) => void;
    error: (error: unknown) => void;
  } {
    return {
      next: (overview) => {
        if (request !== this.listRequest) return;
        this.fundList.set(overview.funds);
        this.total.set(overview.totalMonthlyCents);
        this.loaded.set(true);
      },
      error: (error: unknown) => {
        if (request !== this.listRequest) return;
        this.loadFailed.set(true);
        this.errorHandler.handleError(error);
      },
    };
  }
}
