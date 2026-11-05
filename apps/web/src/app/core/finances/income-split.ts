import { Transaction } from './transaction';

/** One share of the income: a name, a percentage, a display color and the categories it spends on. */
export interface IncomeSplitPart {
  readonly id: string;
  readonly name: string;
  /** Whole number from 0 to 100. */
  readonly percent: number;
  /** Index into `SPLIT_COLORS`. */
  readonly color: number;
  readonly categoryIds: readonly string[];
}

/** How the monthly income is meant to be shared. A category belongs to one part at most. */
export interface IncomeSplit {
  readonly baseIncomeCents: number;
  readonly parts: readonly IncomeSplitPart[];
}

/** What a part is planned and how much of it the month's expenses used. */
export interface PartProgress {
  readonly part: IncomeSplitPart;
  readonly plannedCents: number;
  readonly spentCents: number;
  /** How far spending is past the plan; 0 while within it. */
  readonly overCents: number;
  /** Share of the plan used, whole percent; 0 when nothing is planned. */
  readonly usedPercent: number;
}

/** Whether the percentages add up to the whole income, fall short of it or go past it. */
export type SplitStatus =
  | { readonly kind: 'balanced' }
  | { readonly kind: 'short'; readonly percent: number; readonly cents: number }
  | { readonly kind: 'over'; readonly percent: number };

/** A ready-made way to start a split: part names, percentages and colors. */
export interface SplitPreset {
  readonly label: string;
  readonly parts: readonly Pick<IncomeSplitPart, 'name' | 'percent' | 'color'>[];
}

export const EMPTY_SPLIT: IncomeSplit = { baseIncomeCents: 0, parts: [] };
export const MAX_PARTS = 12;
export const MAX_PART_NAME_LENGTH = 40;
const WHOLE = 100;
const NEW_PART_NAME = 'New part';

/** Part colors, in the order the swatch cycles through them. */
export const SPLIT_COLORS: readonly { readonly hex: string; readonly label: string }[] = [
  { hex: '#9D7BF0', label: 'violet' },
  { hex: '#14A877', label: 'green' },
  { hex: '#B87F06', label: 'amber' },
  { hex: '#2F97CC', label: 'blue' },
  { hex: '#D0609A', label: 'pink' },
  { hex: '#8C8F3A', label: 'olive' },
];

export const SPLIT_PRESETS: readonly SplitPreset[] = [
  {
    label: '50 · 30 · 20',
    parts: [
      { name: 'Needs', percent: 50, color: 0 },
      { name: 'Wants', percent: 30, color: 4 },
      { name: 'Investments', percent: 20, color: 3 },
    ],
  },
  {
    label: '60 · 20 · 10 · 10',
    parts: [
      { name: 'Fixed costs', percent: 60, color: 0 },
      { name: 'Investments', percent: 20, color: 3 },
      { name: 'Education', percent: 10, color: 1 },
      { name: 'Leisure', percent: 10, color: 4 },
    ],
  },
  {
    label: '70 · 20 · 10',
    parts: [
      { name: 'Cost of living', percent: 70, color: 0 },
      { name: 'Investments', percent: 20, color: 3 },
      { name: 'Reserve', percent: 10, color: 2 },
    ],
  },
];

/**
 * What a percentage of the income comes to, rounded to the cent.
 * @example partCents(950000, 30) // 285000
 */
export function partCents(baseIncomeCents: number, percent: number): number {
  return Math.round((baseIncomeCents * percent) / WHOLE);
}

/**
 * The percentages added up.
 * @example totalPercent([{ ...fixed, percent: 60 }, { ...fun, percent: 30 }]) // 90
 */
export function totalPercent(parts: readonly IncomeSplitPart[]): number {
  return parts.reduce((total, part) => total + part.percent, 0);
}

/**
 * Whether the split gives the whole income a destination.
 * @example splitStatus({ baseIncomeCents: 1000, parts: [{ ...fixed, percent: 90 }] }) // { kind: 'short', percent: 10, cents: 100 }
 */
export function splitStatus(split: IncomeSplit): SplitStatus {
  const difference = WHOLE - totalPercent(split.parts);
  if (difference === 0) return { kind: 'balanced' };
  if (difference < 0) return { kind: 'over', percent: -difference };
  return {
    kind: 'short',
    percent: difference,
    cents: partCents(split.baseIncomeCents, difference),
  };
}

/**
 * Whether two splits hold the same plan, which tells an edited split from the saved one.
 * @example sameSplit(saved, { ...saved, baseIncomeCents: 1 }) // false
 */
export function sameSplit(first: IncomeSplit, second: IncomeSplit): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

/**
 * The split with another base income.
 * @example withBaseIncome(split, 950000)
 */
export function withBaseIncome(split: IncomeSplit, baseIncomeCents: number): IncomeSplit {
  return { ...split, baseIncomeCents };
}

/**
 * The split with a part's percentage set, kept to a whole number from 0 to 100.
 * @example withPercent(split, 'fixed', 150) // fixed becomes 100
 */
export function withPercent(split: IncomeSplit, partId: string, percent: number): IncomeSplit {
  const whole = Number.isFinite(percent) ? Math.round(percent) : 0;
  return changePart(split, partId, (part) => ({
    ...part,
    percent: Math.min(WHOLE, Math.max(0, whole)),
  }));
}

/**
 * The split with a part renamed, cut to the length the API accepts.
 * @example withName(split, 'fixed', 'Fixed costs')
 */
export function withName(split: IncomeSplit, partId: string, name: string): IncomeSplit {
  return changePart(split, partId, (part) => ({
    ...part,
    name: name.slice(0, MAX_PART_NAME_LENGTH),
  }));
}

/**
 * The split with a part moved on to the next color.
 * @example withNextColor(split, 'fixed')
 */
export function withNextColor(split: IncomeSplit, partId: string): IncomeSplit {
  return changePart(split, partId, (part) => ({
    ...part,
    color: (part.color + 1) % SPLIT_COLORS.length,
  }));
}

/**
 * The split with a new part at the end that takes what is still unassigned, in a color no part uses
 * yet; unchanged at the limit of parts.
 * @example withAddedPart(split, 'part-7')
 */
export function withAddedPart(split: IncomeSplit, partId: string): IncomeSplit {
  if (split.parts.length >= MAX_PARTS) return split;
  const unused = SPLIT_COLORS.findIndex((_, color) =>
    split.parts.every((part) => part.color !== color),
  );
  const part: IncomeSplitPart = {
    id: partId,
    name: NEW_PART_NAME,
    percent: Math.max(0, WHOLE - totalPercent(split.parts)),
    color: unused === -1 ? split.parts.length % SPLIT_COLORS.length : unused,
    categoryIds: [],
  };
  return { ...split, parts: [...split.parts, part] };
}

/**
 * The split without a part.
 * @example withoutPart(split, 'fixed')
 */
export function withoutPart(split: IncomeSplit, partId: string): IncomeSplit {
  return { ...split, parts: split.parts.filter((part) => part.id !== partId) };
}

/**
 * The split with a category assigned to a part, taken from the part that had it: a category counts
 * toward one part only, so what was spent is never counted twice.
 * @example withCategoryIn(split, 'fun', 'leisure')
 */
export function withCategoryIn(
  split: IncomeSplit,
  partId: string,
  categoryId: string,
): IncomeSplit {
  const cleared = withoutCategory(split, categoryId);
  return changePart(cleared, partId, (part) => ({
    ...part,
    categoryIds: [...part.categoryIds, categoryId],
  }));
}

/**
 * The split with a category taken out of whichever part has it.
 * @example withoutCategory(split, 'leisure')
 */
export function withoutCategory(split: IncomeSplit, categoryId: string): IncomeSplit {
  return {
    ...split,
    parts: split.parts.map((part) => ({
      ...part,
      categoryIds: part.categoryIds.filter((id) => id !== categoryId),
    })),
  };
}

/**
 * The split rebuilt from a preset's parts, keeping the base income; the categories start unassigned.
 * @example withPreset(split, SPLIT_PRESETS[0], ['a', 'b', 'c'])
 */
export function withPreset(
  split: IncomeSplit,
  preset: SplitPreset,
  partIds: readonly string[],
): IncomeSplit {
  const parts = preset.parts.map((part, index) => ({
    ...part,
    id: partIds[index],
    categoryIds: [],
  }));
  return { ...split, parts };
}

/**
 * Each part against what the transactions spent in its categories: only money that went out counts.
 * @example partProgress(split, october)[0].usedPercent // 85
 */
export function partProgress(
  split: IncomeSplit,
  transactions: readonly Transaction[],
): PartProgress[] {
  return split.parts.map((part) => {
    const plannedCents = partCents(split.baseIncomeCents, part.percent);
    const spentCents = spentIn(transactions, part.categoryIds);
    return {
      part,
      plannedCents,
      spentCents,
      overCents: Math.max(0, spentCents - plannedCents),
      usedPercent: plannedCents > 0 ? Math.round((spentCents / plannedCents) * WHOLE) : 0,
    };
  });
}

/**
 * All the money that came in.
 * @example incomeReceivedCents(october) // 1151460
 */
export function incomeReceivedCents(transactions: readonly Transaction[]): number {
  return transactions
    .filter((transaction) => transaction.amountCents > 0)
    .reduce((total, transaction) => total + transaction.amountCents, 0);
}

/**
 * The money that came in under one category.
 * @example incomeReceivedIn(october, 'salary') // 950000
 */
export function incomeReceivedIn(transactions: readonly Transaction[], categoryId: string): number {
  return incomeReceivedCents(
    transactions.filter((transaction) => transaction.categoryId === categoryId),
  );
}

function spentIn(transactions: readonly Transaction[], categoryIds: readonly string[]): number {
  return transactions
    .filter(
      (transaction) => transaction.amountCents < 0 && categoryIds.includes(transaction.categoryId),
    )
    .reduce((total, transaction) => total - transaction.amountCents, 0);
}

function changePart(
  split: IncomeSplit,
  partId: string,
  change: (part: IncomeSplitPart) => IncomeSplitPart,
): IncomeSplit {
  return { ...split, parts: split.parts.map((part) => (part.id === partId ? change(part) : part)) };
}
