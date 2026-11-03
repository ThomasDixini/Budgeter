import { parseIsoDate } from '../calendar/date-label';

/** Which way a bill moves money: a payable goes out when settled, a receivable comes in. */
export type BillKind = 'payable' | 'receivable';

/** How a bill repeats once created; each occurrence is a bill of its own. */
export type BillRecurrence = 'monthly' | 'yearly' | 'installments';

/** When a bill was paid or received, and the account the money left or reached. */
export interface BillSettlement {
  /** Local calendar day, `YYYY-MM-DD`. */
  readonly date: string;
  readonly accountId: string;
}

/** Where a bill sits in the series it was created with: occurrence `number` of `count`. */
export interface BillSeries {
  readonly seriesId: string;
  readonly recurrence: BillRecurrence;
  readonly number: number;
  readonly count: number;
}

/** Money still to be paid or received by its due date; a settled bill has been paid or received. */
export interface Bill {
  readonly id: string;
  readonly kind: BillKind;
  readonly description: string;
  readonly categoryId: string;
  /** Always above zero, whichever way the money moves. */
  readonly amountCents: number;
  /** Local calendar day, `YYYY-MM-DD`. */
  readonly dueDate: string;
  readonly settlement?: BillSettlement;
  readonly series?: BillSeries;
}

/** How a new bill repeats: the kind and the total number of occurrences. */
export interface BillRepeat {
  readonly kind: BillRecurrence;
  readonly count: number;
}

/** What the bill form fills in; the id is given by the store, and a repeat only applies to a new bill. */
export interface BillDraft {
  readonly kind: BillKind;
  readonly description: string;
  readonly categoryId: string;
  readonly amountCents: number;
  readonly dueDate: string;
  readonly repeat?: BillRepeat;
}

/** A card invoice still to be paid; worked out by the API from the card's statement. */
export interface CardInvoiceDue {
  readonly cardId: string;
  /** Local calendar day, `YYYY-MM-DD`. */
  readonly dueOn: string;
  readonly amountCents: number;
  /** Whether the invoice already closed (its purchases are final) or is still taking purchases. */
  readonly isClosed: boolean;
}

/** What the page reads: open and recently settled bills, and the card invoices left to pay. */
export interface BillsAgenda {
  readonly bills: readonly Bill[];
  readonly cardInvoices: readonly CardInvoiceDue[];
}

/** One line of the page: a bill, or a card invoice shown as something to pay. */
export interface AgendaItem {
  readonly key: string;
  readonly kind: BillKind;
  readonly description: string;
  readonly dueDate: string;
  readonly amountCents: number;
  readonly bill?: Bill;
  readonly invoice?: CardInvoiceDue;
}

/** The agenda split by urgency; settled bills are the recently paid or received ones. */
export interface AgendaGroups {
  readonly overdue: readonly AgendaItem[];
  readonly soon: readonly AgendaItem[];
  readonly later: readonly AgendaItem[];
  readonly settled: readonly AgendaItem[];
}

/** How many days ahead (today included) a bill counts as due soon. */
export const SOON_DAYS = 7;
export const MIN_REPEAT_COUNT = 2;
export const MAX_REPEAT_COUNT = 60;
export const MAX_DESCRIPTION_LENGTH = 80;

/** Counts a repeat starts at, by kind. */
export const DEFAULT_REPEAT_COUNTS: Readonly<Record<BillRecurrence, number>> = {
  monthly: 12,
  yearly: 5,
  installments: 6,
};

/** Choices of the repeat select, in display order; `none` is a bill that happens once. */
export const REPEAT_OPTIONS: readonly { value: BillRecurrence | 'none'; label: string }[] = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'monthly', label: 'Every month' },
  { value: 'yearly', label: 'Every year' },
  { value: 'installments', label: 'Monthly installments' },
];

const MS_PER_DAY = 86_400_000;

/**
 * Whole days from one ISO day to another (negative when the second is earlier).
 * @example daysBetween('2026-11-03', '2026-11-10') // 7
 */
export function daysBetween(fromDay: string, toDay: string): number {
  return Math.round((parseIsoDate(toDay).getTime() - parseIsoDate(fromDay).getTime()) / MS_PER_DAY);
}

/**
 * The card invoice shown as a line of its own, to pay on its due day.
 * @example invoiceItem({ cardId: 'visa', dueOn: '2026-11-10', amountCents: 30000, isClosed: true }, 'Visa')
 */
export function invoiceItem(invoice: CardInvoiceDue, cardName: string): AgendaItem {
  return {
    key: `invoice:${invoice.cardId}:${invoice.dueOn}`,
    kind: 'payable',
    description: `${cardName} invoice`,
    dueDate: invoice.dueOn,
    amountCents: invoice.amountCents,
    invoice,
  };
}

/**
 * A bill as a line of the page.
 * @example billItem(rent).key // 'bill:rent'
 */
export function billItem(bill: Bill): AgendaItem {
  return {
    key: `bill:${bill.id}`,
    kind: bill.kind,
    description: bill.description,
    dueDate: bill.dueDate,
    amountCents: bill.amountCents,
    bill,
  };
}

/**
 * Splits the agenda by urgency on a day: open items before it are overdue, those within the next
 * `SOON_DAYS` days are due soon, the rest come later. Open items are ordered by due date, settled bills
 * by the latest settlement first.
 * @example groupAgenda(items, '2026-11-03').soon.map((item) => item.key)
 */
export function groupAgenda(items: readonly AgendaItem[], today: string): AgendaGroups {
  const open = items
    .filter((item) => item.bill?.settlement === undefined)
    .slice()
    .sort((first, second) => first.dueDate.localeCompare(second.dueDate));
  const daysAway = (item: AgendaItem): number => daysBetween(today, item.dueDate);
  return {
    overdue: open.filter((item) => daysAway(item) < 0),
    soon: open.filter((item) => daysAway(item) >= 0 && daysAway(item) < SOON_DAYS),
    later: open.filter((item) => daysAway(item) >= SOON_DAYS),
    settled: items
      .filter((item) => item.bill?.settlement !== undefined)
      .slice()
      .sort((first, second) =>
        (second.bill?.settlement?.date ?? '').localeCompare(first.bill?.settlement?.date ?? ''),
      ),
  };
}

/** What is left to pay and to receive, in cents. */
export interface DueTotals {
  readonly payableCents: number;
  readonly receivableCents: number;
}

/**
 * What the items add up to, by the way the money moves.
 * @example dueTotals(groups.overdue) // { payableCents: 150000, receivableCents: 0 }
 */
export function dueTotals(items: readonly AgendaItem[]): DueTotals {
  const sum = (kind: BillKind): number =>
    items.filter((item) => item.kind === kind).reduce((total, item) => total + item.amountCents, 0);
  return { payableCents: sum('payable'), receivableCents: sum('receivable') };
}

/**
 * Where an open item stands against today, in words.
 * @example dueLabel('2026-11-01', '2026-11-03') // 'Overdue by 2 days'
 */
export function dueLabel(dueDate: string, today: string): string {
  const days = daysBetween(today, dueDate);
  if (days < 0) return `Overdue by ${plural(-days)}`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${plural(days)}`;
}

/**
 * Where a bill sits in its series, when it has one.
 * @example seriesLabel({ seriesId: 'a', recurrence: 'installments', number: 2, count: 6 }) // 'Installment 2/6'
 */
export function seriesLabel(series: BillSeries | undefined): string | undefined {
  if (series === undefined) return undefined;
  const name = series.recurrence === 'installments' ? 'Installment' : repeatName(series.recurrence);
  return `${name} ${series.number}/${series.count}`;
}

/**
 * Whether a typed number of occurrences can be sent: a whole number the API accepts.
 * @example isValidRepeatCount(1) // false
 */
export function isValidRepeatCount(count: number): boolean {
  return Number.isInteger(count) && count >= MIN_REPEAT_COUNT && count <= MAX_REPEAT_COUNT;
}

function repeatName(recurrence: BillRecurrence): string {
  return recurrence === 'yearly' ? 'Yearly' : 'Monthly';
}

function plural(days: number): string {
  return days === 1 ? '1 day' : `${days} days`;
}
