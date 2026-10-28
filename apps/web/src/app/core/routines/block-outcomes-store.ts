import { ErrorHandler, Injectable, inject, signal } from '@angular/core';
import { Clock } from '../calendar/clock';
import { isoDate } from '../calendar/date-label';
import { formatClock } from '../calendar/time-of-day';
import { BlockOutcomesGateway } from './block-outcomes-gateway';
import { BlockOutcome, BlockOutcomeKind } from './day-plan';

/**
 * Routine blocks completed or skipped today. Recording applies locally first and rolls back if
 * the gateway rejects it.
 */
@Injectable({ providedIn: 'root' })
export class BlockOutcomesStore {
  private readonly gateway = inject(BlockOutcomesGateway);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly today = isoDate(inject(Clock).now());
  private readonly outcomeList = signal<readonly BlockOutcome[]>([]);

  /** Today's outcomes, in the order they were recorded. */
  readonly outcomes = this.outcomeList.asReadonly();

  constructor() {
    this.gateway.list(this.today).subscribe({
      next: (outcomes) => this.outcomeList.set(outcomes),
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
    this.gateway.record(this.today, outcome).subscribe({
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
    this.gateway.undo(this.today, routineId, blockId).subscribe({
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
