import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { parseIsoDate } from '../../calendar/date-label';
import { Bill } from '../bills';
import { SinkingFund, SinkingFundDraft, SinkingFundsOverview } from '../sinking-funds';
import { SinkingFundsGateway } from '../sinking-funds-gateway';
import { addDays, addMonths, dayOfMonth } from './demo-dates';
import { DemoFinances } from './demo-finances';

const MONTHS_PER_YEAR = 12;
const SEEDED_FIXED_MONTHS_AHEAD = 5;
const SEEDED_GROOMING_DAYS_AHEAD = 21;

/** What the demo keeps for a fund: the stored schedule, without the figures worked out from it. */
type StoredFund = Omit<SinkingFund, 'savedCents' | 'monthlyCents' | 'cycleStart'>;

function dayOf(isoDay: string): number {
  return Number(isoDay.slice(8, 10));
}

/** A due date `months` away from `due`, keeping the due day (short months use their last day). */
function shiftDue(due: string, months: number, dueDay: number): string {
  return dayOfMonth(addMonths(due, months), dueDay);
}

/** Whole months from `start` to `today`, one less when the day of the month has not been reached. */
function wholeMonthsBetween(start: string, today: string): number {
  const from = parseIsoDate(start);
  const to = parseIsoDate(today);
  const months = (to.getFullYear() - from.getFullYear()) * MONTHS_PER_YEAR;
  const whole = months + to.getMonth() - from.getMonth();
  return to.getDate() < from.getDate() ? whole - 1 : whole;
}

/**
 * The figures a fund shows on `today`, worked out as the API does, in integer cents.
 * @example summarize(fund, '2026-11-04').monthlyCents // 10000 for a 120000 yearly fund
 */
export function summarize(fund: StoredFund, today: string): SinkingFund {
  const cycleMonths = fund.schedule.intervalMonths;
  const cycleStart = shiftDue(fund.schedule.nextDueDate, -cycleMonths, fund.schedule.day);
  const elapsed = Math.min(Math.max(wholeMonthsBetween(cycleStart, today), 0), cycleMonths);
  return {
    ...fund,
    cycleStart,
    savedCents: Math.floor((2 * fund.amountCents * elapsed + cycleMonths) / (2 * cycleMonths)),
    monthlyCents: Math.ceil(fund.amountCents / cycleMonths),
  };
}

/** The first date on or after `today` that falls on the given month and day of the year. */
function nextYearlyDue(month: number, day: number, today: string): string {
  const year = Number(today.slice(0, 4));
  const monthText = String(month).padStart(2, '0');
  const thisYear = dayOfMonth(`${year}-${monthText}`, day);
  return thisYear >= today ? thisYear : dayOfMonth(`${year + 1}-${monthText}`, day);
}

function storedFrom(id: string, today: string, draft: SinkingFundDraft): StoredFund {
  const { schedule } = draft;
  const base = {
    id,
    description: draft.description,
    categoryId: draft.categoryId,
    amountCents: draft.amountCents,
  };
  if (schedule.kind === 'fixedDate') {
    const nextDueDate = nextYearlyDue(schedule.month, schedule.day, today);
    return {
      ...base,
      schedule: {
        kind: 'fixedDate',
        intervalMonths: MONTHS_PER_YEAR,
        month: schedule.month,
        day: schedule.day,
        nextDueDate,
      },
    };
  }
  return {
    ...base,
    schedule: {
      kind: 'everyMonths',
      intervalMonths: schedule.intervalMonths,
      day: dayOf(schedule.nextDueDate),
      nextDueDate: schedule.nextDueDate,
    },
  };
}

function seedFunds(today: string): StoredFund[] {
  const vehicleDue = shiftDue(today, SEEDED_FIXED_MONTHS_AHEAD, dayOf(today));
  const groomingDue = addDays(today, SEEDED_GROOMING_DAYS_AHEAD);
  return [
    storedFrom('demo-sinking-vehicle-tax', today, {
      description: 'Vehicle tax (IPVA)',
      categoryId: 'transport',
      amountCents: 120_000,
      schedule: {
        kind: 'fixedDate',
        month: Number(vehicleDue.slice(5, 7)),
        day: dayOf(vehicleDue),
      },
    }),
    storedFrom('demo-sinking-dog-grooming', today, {
      description: 'Dog grooming',
      categoryId: 'health',
      amountCents: 10_000,
      schedule: { kind: 'everyMonths', intervalMonths: 2, nextDueDate: groomingDue },
    }),
  ];
}

function byDueDateThenDescription(first: StoredFund, second: StoredFund): number {
  return (
    first.schedule.nextDueDate.localeCompare(second.schedule.nextDueDate) ||
    first.description.localeCompare(second.description)
  );
}

/** Sinking funds kept in memory by the demo; nothing is sent anywhere and rolling creates no bills. */
@Injectable()
export class DemoSinkingFundsGateway extends SinkingFundsGateway {
  private funds: StoredFund[] = seedFunds(inject(DemoFinances).today);

  override list(today: string): Observable<SinkingFundsOverview> {
    const summaries = [...this.funds]
      .sort(byDueDateThenDescription)
      .map((fund) => summarize(fund, today));
    const totalMonthlyCents = summaries.reduce((total, fund) => total + fund.monthlyCents, 0);
    return of({ funds: summaries, totalMonthlyCents });
  }

  override save(id: string, today: string, draft: SinkingFundDraft): Observable<SinkingFund> {
    const stored = storedFrom(id, today, draft);
    this.funds = [...this.funds.filter((fund) => fund.id !== id), stored];
    return of(summarize(stored, today));
  }

  override delete(id: string): Observable<void> {
    this.funds = this.funds.filter((fund) => fund.id !== id);
    return of(undefined);
  }

  override roll(): Observable<readonly Bill[]> {
    return of([]);
  }
}
