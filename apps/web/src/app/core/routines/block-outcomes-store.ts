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
      error: (error: unknown) => {
        this.outcomeList.set(before);
        this.errorHandler.handleError(error);
      },
    });
  }
}

function isSameBlock(first: BlockOutcome, second: BlockOutcome): boolean {
  return first.routineId === second.routineId && first.blockId === second.blockId;
}
