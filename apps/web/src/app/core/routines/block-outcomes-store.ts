import { ErrorHandler, Injectable, inject, signal } from '@angular/core';
import { Clock } from '../calendar/clock';
import { isoDate } from '../calendar/date-label';
import { formatClock } from '../calendar/time-of-day';
import { BlockOutcomesGateway } from './block-outcomes-gateway';
import { BlockOutcome, BlockOutcomeKind } from './day-plan';
import { RoutinesStore } from './routines-store';

/**
 * Routine blocks completed or skipped on the day being shown (today unless `showDay` moves it, as a
 * night shift that began yesterday does). Recording applies locally first and rolls back if the
 * gateway rejects it.
 */
@Injectable({ providedIn: 'root' })
export class BlockOutcomesStore {
  private readonly gateway = inject(BlockOutcomesGateway);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly goals = inject(RoutinesStore);
  private readonly day = signal(isoDate(inject(Clock).now()));
  private readonly outcomeList = signal<readonly BlockOutcome[]>([]);

  /** Today's outcomes, in the order they were recorded. */
  readonly outcomes = this.outcomeList.asReadonly();

  constructor() {
    this.load(this.day());
  }

  /**
   * Switches to the outcomes of another ISO day, e.g. the evening a night shift began on.
   * @example store.showDay('2026-10-26')
   */
  showDay(isoDay: string): void {
    if (isoDay === this.day()) return;
    this.day.set(isoDay);
    this.outcomeList.set([]);
    this.load(isoDay);
  }

  private load(isoDay: string): void {
    this.gateway.list(isoDay).subscribe({
      // A slow answer for a day that is no longer shown must not replace the current one.
      next: (outcomes) => {
        if (this.day() === isoDay) this.outcomeList.set(outcomes);
      },
      error: (error: unknown) => this.errorHandler.handleError(error),
    });
  }

  /**
   * Ends a block of a routine now, as done or skipped, for today only.
   * @example store.record('weekdays', 'project', 'done', 1240) // ended at 20:40
   */
  record(routineId: string, blockId: string, kind: BlockOutcomeKind, nowMinutes: number): void {
    const outcome: BlockOutcome = {
      routineId,
      blockId,
      outcome: kind,
      at: formatClock(nowMinutes),
    };
    const before = this.outcomeList();
    this.outcomeList.set([...before.filter((current) => !isSameBlock(current, outcome)), outcome]);
    this.gateway.record(this.day(), outcome).subscribe({
      // The API counts (or takes back) the block for goals tracked from blocks, so reload them.
      complete: () => this.goals.refreshGoals(),
      error: (error: unknown) => this.rejected(error, before),
    });
  }

  /**
   * Takes back a completed or skipped block, so it and the blocks after it return to plan.
   * @example store.undo('weekdays', 'project')
   */
  undo(routineId: string, blockId: string): void {
    const before = this.outcomeList();
    const target = { routineId, blockId };
    this.outcomeList.set(before.filter((current) => !isSameBlock(current, target)));
    this.gateway.undo(this.day(), routineId, blockId).subscribe({
      complete: () => this.goals.refreshGoals(),
      error: (error: unknown) => this.rejected(error, before),
    });
  }

  private rejected(error: unknown, before: readonly BlockOutcome[]): void {
    this.outcomeList.set(before);
    this.errorHandler.handleError(error);
  }
}

function isSameBlock(
  first: Pick<BlockOutcome, 'routineId' | 'blockId'>,
  second: Pick<BlockOutcome, 'routineId' | 'blockId'>,
): boolean {
  return first.routineId === second.routineId && first.blockId === second.blockId;
}
