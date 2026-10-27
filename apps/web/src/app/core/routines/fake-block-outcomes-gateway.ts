import { Observable, of, throwError } from 'rxjs';
import { BlockOutcomesGateway } from './block-outcomes-gateway';
import { BlockOutcome } from './day-plan';

/** Test double answering synchronously from memory; set `failure` to make the next calls fail. */
export class FakeBlockOutcomesGateway extends BlockOutcomesGateway {
  failure: Error | undefined;
  /** Calls to `record`, in order. */
  readonly recorded: { readonly isoDay: string; readonly outcome: BlockOutcome }[] = [];

  constructor(private readonly outcomes: readonly BlockOutcome[] = []) {
    super();
  }

  override list(): Observable<readonly BlockOutcome[]> {
    return this.failure === undefined ? of(this.outcomes) : throwError(() => this.failure);
  }

  override record(isoDay: string, outcome: BlockOutcome): Observable<BlockOutcome> {
    this.recorded.push({ isoDay, outcome });
    return this.failure === undefined ? of(outcome) : throwError(() => this.failure);
  }
}
