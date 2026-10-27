import { Observable } from 'rxjs';
import { BlockOutcome } from './day-plan';

/**
 * Port to wherever the blocks completed or skipped each day are stored. The store depends on
 * this class only; `app.config.ts` binds it to the HTTP adapter and tests to a fake.
 */
export abstract class BlockOutcomesGateway {
  /** Outcomes recorded on an ISO date, in the order they were recorded. */
  abstract list(isoDay: string): Observable<readonly BlockOutcome[]>;

  /** Records an outcome on an ISO date; recording the same block again replaces it. */
  abstract record(isoDay: string, outcome: BlockOutcome): Observable<BlockOutcome>;
}
