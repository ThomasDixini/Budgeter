import { Component, ErrorHandler, LOCALE_ID, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, catchError, switchMap } from 'rxjs';
import { PageHeading } from '../../../components/page-heading/page-heading';
import { Clock } from '../../../core/calendar/clock';
import { isoDate, longDateLabel } from '../../../core/calendar/date-label';
import { Category, findCategory } from '../../../core/routines/category';
import {
  HistoryBlock,
  goalsMetOn,
  goalsShortOn,
  historyBlocks,
  historyPeriodLabel,
} from '../../../core/routines/day-history';
import { DayRecord, DayRecords } from '../../../core/routines/day-records';
import { GOAL_TYPE_LABELS, Goal, goalExtra, parseIsoDate } from '../../../core/routines/goal';
import { RoutinesStore } from '../../../core/routines/routines-store';

interface HistoryGoalView {
  readonly goal: Goal;
  readonly category?: Category;
  /** Type and the period around the day, e.g. "Frequency · Week of Oct 26". */
  readonly meta: string;
  /** e.g. "6/5 · 1 extra", or "Achieved" for an objective. */
  readonly value: string;
}

/**
 * A past day as it was recorded: the routine blocks completed or skipped and the goals met, picked
 * with a date field or the previous/next day buttons.
 */
@Component({
  selector: 'app-routines-history',
  imports: [PageHeading],
  templateUrl: './history.html',
  styleUrl: './history.css',
})
export class History {
  private readonly store = inject(RoutinesStore);
  private readonly records = inject(DayRecords);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly locale = inject(LOCALE_ID);
  private readonly now = inject(Clock).now();

  protected readonly todayIso = isoDate(this.now);
  /** Starts on yesterday: the last day that is over. */
  protected readonly day = signal(this.dayBefore(this.todayIso));
  protected readonly dayLabel = computed(() =>
    longDateLabel(parseIsoDate(this.day()), this.locale),
  );
  protected readonly isToday = computed(() => this.day() === this.todayIso);

  private readonly record = toSignal(
    toObservable(this.day).pipe(switchMap((isoDay) => this.load(isoDay))),
  );
  /** The record of the day shown, so a slow answer for another day never shows under this one. */
  private readonly shown = computed(() => {
    const record = this.record();
    return record?.isoDay === this.day() ? record : undefined;
  });
  protected readonly isLoading = computed(() => this.shown() === undefined);
  protected readonly blocks = computed((): HistoryBlock[] => {
    const record = this.shown();
    if (record === undefined) return [];
    return historyBlocks(record.outcomes, this.store.routines(), this.store.categories());
  });
  protected readonly completed = computed(() =>
    this.blocks().filter((block) => block.outcome === 'done'),
  );
  protected readonly skipped = computed(() =>
    this.blocks().filter((block) => block.outcome === 'skipped'),
  );
  protected readonly goalsMet = computed(() =>
    goalsMetOn(this.shown()?.goals ?? [], this.day()).map((goal) => this.toView(goal)),
  );
  protected readonly goalsShort = computed(() =>
    goalsShortOn(this.shown()?.goals ?? []).map((goal) => this.toView(goal)),
  );

  /**
   * Shows the day the date field was set to; an empty or future date is ignored.
   * @example this.pick('2026-10-20')
   */
  protected pick(isoDay: string): void {
    if (isoDay === '' || isoDay > this.todayIso) return;
    this.day.set(isoDay);
  }

  protected previousDay(): void {
    this.day.set(this.dayBefore(this.day()));
  }

  protected nextDay(): void {
    if (!this.isToday()) this.day.set(this.dayAfter(this.day()));
  }

  protected valueOf(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  /** A failed load is reported and leaves the page loading, rather than showing an empty day as if real. */
  private load(isoDay: string): Observable<DayRecord> {
    return this.records.load(isoDay).pipe(
      catchError((error: unknown) => {
        this.errorHandler.handleError(error);
        return EMPTY;
      }),
    );
  }

  private toView(goal: Goal): HistoryGoalView {
    const period = historyPeriodLabel(goal.period, this.day(), goal.deadline);
    const extra = goalExtra(goal);
    return {
      goal,
      category: findCategory(this.store.categories(), goal.categoryId),
      meta: `${GOAL_TYPE_LABELS[goal.type]} · ${period}`,
      value:
        goal.type === 'objective'
          ? 'Achieved'
          : `${goal.done}/${goal.target}${extra > 0 ? ` · ${extra} extra` : ''}`,
    };
  }

  private dayBefore(isoDay: string): string {
    const day = parseIsoDate(isoDay);
    return isoDate(new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1));
  }

  private dayAfter(isoDay: string): string {
    const day = parseIsoDate(isoDay);
    return isoDate(new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1));
  }
}
