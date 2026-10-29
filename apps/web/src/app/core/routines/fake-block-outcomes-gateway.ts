import { Observable, of, throwError } from 'rxjs';
import { BlockOutcomesGateway } from './block-outcomes-gateway';
import { BlockOutcome } from './day-plan';

/** Test double answering synchronously from memory; set `failure` to make the next calls fail. */
export class FakeBlockOutcomesGateway extends BlockOutcomesGateway {
  failure: Error | undefined;
  /** Calls to `record`, in order. */
  readonly recorded: { readonly isoDay: string; readonly outcome: BlockOutcome }[] = [];
  /** Calls to `undo`, in order. */
  readonly undone: {
    readonly isoDay: string;
    readonly routineId: string;
    readonly blockId: string;
  }[] = [];

  constructor(private readonly outcomes: readonly BlockOutcome[] = []) {
    super();
  }

  /** Days `list` was asked for, in order. */
  readonly listedDays: string[] = [];

  override list(isoDay: string): Observable<readonly BlockOutcome[]> {
    this.listedDays.push(isoDay);
    return this.failure === undefined ? of(this.outcomes) : throwError(() => this.failure);
  }

  override record(isoDay: string, outcome: BlockOutcome): Observable<BlockOutcome> {
    this.recorded.push({ isoDay, outcome });
    return this.failure === undefined ? of(outcome) : throwError(() => this.failure);
  }

  override undo(isoDay: string, routineId: string, blockId: string): Observable<void> {
    this.undone.push({ isoDay, routineId, blockId });
    return this.failure === undefined ? of(undefined) : throwError(() => this.failure);
  }
}
