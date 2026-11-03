import { Observable } from 'rxjs';
import { Bill, BillDraft, BillSettlement, BillsAgenda } from './bills';

/**
 * Port to wherever bills are stored. `app.config.ts` binds it to the HTTP adapter and tests to a fake.
 */
export abstract class BillsGateway {
  /** The open bills due soon or overdue, the recently settled ones and the card invoices left to pay. */
  abstract agenda(asOf: string): Observable<BillsAgenda>;

  /**
   * Creates the bill (and every occurrence of it, when it repeats) or replaces an open one; answers
   * with what was stored.
   */
  abstract save(billId: string, draft: BillDraft): Observable<readonly Bill[]>;

  /** Deletes one bill; deleting one already gone succeeds. */
  abstract delete(billId: string): Observable<void>;

  /** Marks the bill paid or received; the API records the transaction. */
  abstract settle(billId: string, settlement: BillSettlement): Observable<Bill>;

  /** Undoes a settlement; the API removes the transaction. */
  abstract reopen(billId: string): Observable<Bill>;
}
