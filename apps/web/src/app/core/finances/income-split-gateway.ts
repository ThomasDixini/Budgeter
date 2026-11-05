import { Observable } from 'rxjs';
import { IncomeSplit } from './income-split';

/**
 * Port to wherever the income split plan is stored. `app.config.ts` binds it to the HTTP adapter and
 * tests to a fake.
 */
export abstract class IncomeSplitGateway {
  /** The saved plan; an empty one before the first save. */
  abstract get(): Observable<IncomeSplit>;

  /** Replaces the whole plan; answers with the stored version. */
  abstract save(split: IncomeSplit): Observable<IncomeSplit>;
}
