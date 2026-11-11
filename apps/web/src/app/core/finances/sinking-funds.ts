/** How a sinking fund's due dates repeat: every N months from a first date, or on one day of the year. */
export type SinkingFundScheduleKind = 'everyMonths' | 'fixedDate';

/** When a fund's bill falls due. Dates are local calendar days as `YYYY-MM-DD`. */
export interface SinkingFundSchedule {
  readonly kind: SinkingFundScheduleKind;
  /** Months between due dates (1-60); always 12 for a `fixedDate` fund. */
  readonly intervalMonths: number;
  /** Month of the year (1-12) of a `fixedDate` fund; absent for `everyMonths`. */
  readonly month?: number;
  /** Day of the month (1-31) the bill is due; short months use their last day. */
  readonly day: number;
  /** The next due date, `YYYY-MM-DD`. */
  readonly nextDueDate: string;
}

/** Money set aside over months for an irregular bill. Amounts are integer cents. */
export interface SinkingFund {
  readonly id: string;
  readonly description: string;
  readonly categoryId: string;
  /** What the bill costs when it falls due, in cents. */
  readonly amountCents: number;
  readonly schedule: SinkingFundSchedule;
  /** What should be set aside by today, in cents. */
  readonly savedCents: number;
  /** What to set aside each month to reach the amount in time, in cents. */
  readonly monthlyCents: number;
  /** First day of the current saving cycle, `YYYY-MM-DD`. */
  readonly cycleStart: string;
}

/** Every fund plus the monthly amount all of them ask for together, in cents. */
export interface SinkingFundsOverview {
  readonly funds: readonly SinkingFund[];
  readonly totalMonthlyCents: number;
}

/** The schedule a person fills in: the first due date, or the month and day of the year. */
export type SinkingFundScheduleDraft =
  | {
      readonly kind: 'everyMonths';
      readonly intervalMonths: number;
      /** First due date, `YYYY-MM-DD`, on or after today. */
      readonly nextDueDate: string;
    }
  | { readonly kind: 'fixedDate'; readonly month: number; readonly day: number };

/** What a person fills in to create or replace a fund. Amounts are integer cents. */
export interface SinkingFundDraft {
  readonly description: string;
  readonly categoryId: string;
  readonly amountCents: number;
  readonly schedule: SinkingFundScheduleDraft;
}
