import { Observable, of, throwError } from 'rxjs';
import { Bill } from './bills';
import {
  SinkingFund,
  SinkingFundDraft,
  SinkingFundSchedule,
  SinkingFundScheduleDraft,
  SinkingFundsOverview,
} from './sinking-funds';
import { SinkingFundsGateway } from './sinking-funds-gateway';

/** An annual vehicle tax, three quarters saved, due on 15 January. */
export const SAMPLE_SINKING_FUND: SinkingFund = {
  id: 'ipva',
  description: 'IPVA',
  categoryId: 'transport',
  amountCents: 120000,
  schedule: { kind: 'fixedDate', intervalMonths: 12, month: 1, day: 15, nextDueDate: '2027-01-15' },
  savedCents: 90000,
  monthlyCents: 10000,
  cycleStart: '2026-01-15',
};

/** Test double answering synchronously from memory; set `failure` to make the next calls fail. */
export class FakeSinkingFundsGateway extends SinkingFundsGateway {
  failure: Error | undefined;
  overviewToServe: SinkingFundsOverview = {
    funds: [SAMPLE_SINKING_FUND],
    totalMonthlyCents: 10000,
  };
  billsToRoll: readonly Bill[] = [];
  readonly saved: { id: string; today: string; draft: SinkingFundDraft }[] = [];
  readonly deleted: string[] = [];
  /** Days `list` was asked for, in order. */
  readonly askedDays: string[] = [];
  /** Days `roll` was asked for, in order. */
  readonly rolledDays: string[] = [];

  override list(today: string): Observable<SinkingFundsOverview> {
    this.askedDays.push(today);
    return this.answer(this.overviewToServe);
  }

  override save(id: string, today: string, draft: SinkingFundDraft): Observable<SinkingFund> {
    this.saved.push({ id, today, draft });
    const { description, categoryId, amountCents, schedule } = draft;
    const cycleMonths = schedule.kind === 'everyMonths' ? schedule.intervalMonths : 12;
    const monthlyCents = Math.ceil(amountCents / cycleMonths);
    const cycleStart = schedule.kind === 'everyMonths' ? schedule.nextDueDate : '2026-01-15';
    const stored = { id, description, categoryId, amountCents, savedCents: 0 };
    return this.answer({ ...stored, schedule: storedSchedule(schedule), monthlyCents, cycleStart });
  }

  override delete(id: string): Observable<void> {
    this.deleted.push(id);
    return this.answer(undefined);
  }

  override roll(today: string): Observable<readonly Bill[]> {
    this.rolledDays.push(today);
    return this.answer(this.billsToRoll);
  }

  private answer<TValue>(value: TValue): Observable<TValue> {
    return this.failure === undefined ? of(value) : throwError(() => this.failure);
  }
}

function storedSchedule(draft: SinkingFundScheduleDraft): SinkingFundSchedule {
  if (draft.kind === 'everyMonths') {
    const day = Number(draft.nextDueDate.slice(8, 10));
    const { intervalMonths, nextDueDate } = draft;
    return { kind: 'everyMonths', intervalMonths, day, nextDueDate };
  }
  const { month, day } = draft;
  const nextDueDate = `2027-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { kind: 'fixedDate', intervalMonths: 12, month, day, nextDueDate };
}
