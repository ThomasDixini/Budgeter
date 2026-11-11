import { Observable } from 'rxjs';
import { Bill } from './bills';
import { SinkingFund, SinkingFundDraft, SinkingFundsOverview } from './sinking-funds';

/**
 * Port to wherever sinking funds are stored. `app.config.ts` binds it to the HTTP adapter and tests
 * to a fake. `today` is always a local calendar day as `YYYY-MM-DD`.
 */
export abstract class SinkingFundsGateway {
  /** Every fund with what should be saved by `today`, and the total monthly amount. */
  abstract list(today: string): Observable<SinkingFundsOverview>;

  /** Creates the fund or replaces it; answers with what was stored. */
  abstract save(id: string, today: string, draft: SinkingFundDraft): Observable<SinkingFund>;

  /** Deletes one fund; deleting one already gone succeeds. */
  abstract delete(id: string): Observable<void>;

  /** Turns the funds due by `today` into bills and starts their next cycle; answers with the bills created. */
  abstract roll(today: string): Observable<readonly Bill[]>;
}
