import { Observable, of, throwError } from 'rxjs';
import { IncomeSplit } from './income-split';
import { IncomeSplitGateway } from './income-split-gateway';

/** R$ 9,500.00 shared in two: fixed costs (housing, food) and leisure (health is left unassigned). */
export const SAMPLE_SPLIT: IncomeSplit = {
  baseIncomeCents: 950000,
  parts: [
    { id: 'fixed', name: 'Fixed costs', percent: 60, color: 0, categoryIds: ['food'] },
    { id: 'fun', name: 'Leisure', percent: 10, color: 4, categoryIds: [] },
  ],
};

/** Test double answering synchronously from memory; set `failure` to make the next calls fail. */
export class FakeIncomeSplitGateway extends IncomeSplitGateway {
  failure: Error | undefined;
  readonly saved: IncomeSplit[] = [];
  /** How many times `get` was called. */
  getCalls = 0;

  constructor(private readonly stored: IncomeSplit = SAMPLE_SPLIT) {
    super();
  }

  override get(): Observable<IncomeSplit> {
    this.getCalls += 1;
    return this.answer(this.stored);
  }

  override save(split: IncomeSplit): Observable<IncomeSplit> {
    this.saved.push(split);
    return this.answer(split);
  }

  private answer<TValue>(value: TValue): Observable<TValue> {
    return this.failure === undefined ? of(value) : throwError(() => this.failure);
  }
}
