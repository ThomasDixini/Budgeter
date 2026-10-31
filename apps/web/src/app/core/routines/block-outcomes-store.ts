import { ErrorHandler, Injectable, inject, signal } from '@angular/core';
import { Clock } from '../calendar/clock';
import { isoDate } from '../calendar/date-label';
import { formatClock } from '../calendar/time-of-day';
import { BlockOutcomesGateway } from './block-outcomes-gateway';
import { BlockOutcome, BlockOutcomeKind } from './day-plan';
import { Positioned, positionOf, restoredAt } from './list-positions';
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
    const day = this.day();
    const replaced = this.takeOut(outcome);
    this.outcomeList.update((outcomes) => [...outcomes, outcome]);
    this.gateway.record(day, outcome).subscribe({
      // The API counts (or takes back) the block for goals tracked from blocks, so reload them.
      complete: () => this.goals.refreshGoals(),
      error: (error: unknown) =>
        this.rejected(error, day, () => this.undoRecord(outcome, replaced)),
    });
  }

  /**
   * Takes back a completed or skipped block, so it and the blocks after it return to plan.
   * @example store.undo('weekdays', 'project')
   */
  undo(routineId: string, blockId: string): void {
    const day = this.day();
    const removed = this.takeOut({ routineId, blockId });
    this.gateway.undo(day, routineId, blockId).subscribe({
      complete: () => this.goals.refreshGoals(),
      error: (error: unknown) => this.rejected(error, day, () => this.putBack(removed)),
    });
  }

  /** Removes the block's outcome from the list and tells where it was, if it had one. */
  private takeOut(
    block: Pick<BlockOutcome, 'routineId' | 'blockId'>,
  ): Positioned<BlockOutcome> | undefined {
    const removed = positionOf(this.outcomeList(), (current) => isSameBlock(current, block));
    this.outcomeList.update((outcomes) =>
      outcomes.filter((current) => !isSameBlock(current, block)),
    );
    return removed;
  }

  /**
   * Drops a rejected outcome, unless a newer one of the block replaced it, and puts back the one it
   * replaced.
   */
  private undoRecord(failed: BlockOutcome, replaced: Positioned<BlockOutcome> | undefined): void {
    if (!this.outcomeList().includes(failed)) return;
    this.outcomeList.update((outcomes) => outcomes.filter((current) => current !== failed));
    this.putBack(replaced);
  }

  private putBack(removed: Positioned<BlockOutcome> | undefined): void {
    if (removed === undefined) return;
    this.outcomeList.update((outcomes) => restoredAt(outcomes, removed, isSameBlock));
  }

  /**
   * Rolls back only while the same day is shown: the list of another day must not get this one's
   * outcomes.
   */
  private rejected(error: unknown, day: string, rollback: () => void): void {
    if (this.day() === day) rollback();
    this.errorHandler.handleError(error);
  }
}

function isSameBlock(
  first: Pick<BlockOutcome, 'routineId' | 'blockId'>,
  second: Pick<BlockOutcome, 'routineId' | 'blockId'>,
): boolean {
  return first.routineId === second.routineId && first.blockId === second.blockId;
}
