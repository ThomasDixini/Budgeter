import { SAMPLE_OCTOBER } from './fake-finances-gateways';
import { SAMPLE_SPLIT } from './fake-income-split-gateway';
import {
  EMPTY_SPLIT,
  IncomeSplit,
  MAX_PARTS,
  SPLIT_COLORS,
  SPLIT_PRESETS,
  incomeReceivedCents,
  incomeReceivedIn,
  partCents,
  partProgress,
  sameSplit,
  splitStatus,
  totalPercent,
  withAddedPart,
  withBaseIncome,
  withCategoryIn,
  withName,
  withNextColor,
  withPercent,
  withPreset,
  withoutCategory,
  withoutPart,
} from './income-split';
import { Transaction } from './transaction';

const FIXED = SAMPLE_SPLIT.parts[0];
const FUN = SAMPLE_SPLIT.parts[1];

function spend(id: string, categoryId: string, amountCents: number): Transaction {
  return {
    id,
    date: '2026-10-10',
    description: id,
    categoryId,
    accountId: 'checking-account',
    amountCents,
  };
}

function percents(split: IncomeSplit): number[] {
  return split.parts.map((part) => part.percent);
}

describe('partCents', () => {
  it('takes a percentage of the income, rounded to the cent', () => {
    expect([partCents(950000, 30), partCents(1000, 33)]).toEqual([285000, 330]);
  });
});

describe('splitStatus', () => {
  it('is balanced at exactly 100%', () => {
    const balanced = withPercent(SAMPLE_SPLIT, 'fun', 40);

    expect(splitStatus(balanced)).toEqual({ kind: 'balanced' });
  });

  it('says how much is left without a destination', () => {
    expect(splitStatus(SAMPLE_SPLIT)).toEqual({ kind: 'short', percent: 30, cents: 285000 });
  });

  it('says how far past the whole it went', () => {
    expect(splitStatus(withPercent(SAMPLE_SPLIT, 'fun', 60))).toEqual({
      kind: 'over',
      percent: 20,
    });
  });

  it('counts an empty split as all of it left', () => {
    expect(splitStatus(EMPTY_SPLIT)).toEqual({ kind: 'short', percent: 100, cents: 0 });
  });
});

describe('editing a split', () => {
  it('keeps a percentage to a whole number from 0 to 100', () => {
    const edited = [150, -5, 12.6, Number.NaN].map(
      (percent) => percents(withPercent(SAMPLE_SPLIT, 'fixed', percent))[0],
    );

    expect(edited).toEqual([100, 0, 13, 0]);
  });

  it('renames a part within the length the API accepts', () => {
    const renamed = withName(SAMPLE_SPLIT, 'fixed', 'x'.repeat(60));

    expect(renamed.parts[0].name).toHaveLength(40);
  });

  it('cycles a part through the colors and back', () => {
    const last = { ...SAMPLE_SPLIT, parts: [{ ...FIXED, color: SPLIT_COLORS.length - 1 }] };

    expect(withNextColor(last, 'fixed').parts[0].color).toBe(0);
  });

  it('sets the base income', () => {
    expect(withBaseIncome(SAMPLE_SPLIT, 1).baseIncomeCents).toBe(1);
  });

  it('adds a part that takes what is unassigned, in a color not used yet', () => {
    const added = withAddedPart(SAMPLE_SPLIT, 'new');

    expect(added.parts[2]).toEqual({
      id: 'new',
      name: 'New part',
      percent: 30,
      color: 1,
      categoryIds: [],
    });
  });

  it('adds a part with no percent once the split is full', () => {
    const full = withPercent(SAMPLE_SPLIT, 'fun', 40);

    expect(withAddedPart(full, 'new').parts[2].percent).toBe(0);
  });

  it('stops adding parts at the limit', () => {
    const manyParts = Array.from({ length: MAX_PARTS }, (_, index) => ({
      ...FIXED,
      id: `part-${index}`,
      categoryIds: [],
    }));
    const full = { ...EMPTY_SPLIT, parts: manyParts };

    expect(withAddedPart(full, 'extra')).toBe(full);
  });

  it('removes a part', () => {
    expect(withoutPart(SAMPLE_SPLIT, 'fixed').parts.map((part) => part.id)).toEqual(['fun']);
  });
});

describe('categories of a split', () => {
  it('moves a category to the part chosen, so it counts toward one part only', () => {
    const moved = withCategoryIn(SAMPLE_SPLIT, 'fun', 'food');

    expect(moved.parts.map((part) => part.categoryIds)).toEqual([[], ['food']]);
  });

  it('takes a category out of whichever part has it', () => {
    expect(withoutCategory(SAMPLE_SPLIT, 'food').parts[0].categoryIds).toEqual([]);
  });
});

describe('withPreset', () => {
  it('rebuilds the parts from the preset, keeping the base income and leaving categories unassigned', () => {
    const preset = SPLIT_PRESETS[0];

    const rebuilt = withPreset(SAMPLE_SPLIT, preset, ['a', 'b', 'c']);

    expect([
      rebuilt.baseIncomeCents,
      rebuilt.parts.map((part) => [part.id, part.name, part.percent, part.categoryIds.length]),
    ]).toEqual([
      950000,
      [
        ['a', 'Needs', 50, 0],
        ['b', 'Wants', 30, 0],
        ['c', 'Investments', 20, 0],
      ],
    ]);
  });

  it('offers presets that each add up to 100%', () => {
    expect(
      SPLIT_PRESETS.map((preset) =>
        totalPercent(withPreset(EMPTY_SPLIT, preset, ['a', 'b', 'c', 'd']).parts),
      ),
    ).toEqual([100, 100, 100]);
  });
});

describe('partProgress', () => {
  it('sums what the expenses of the part categories spent, against its planned share', () => {
    const progress = partProgress(SAMPLE_SPLIT, [
      spend('a', 'food', -100000),
      spend('b', 'food', -50000),
    ]);

    expect(progress[0]).toMatchObject({
      plannedCents: 570000,
      spentCents: 150000,
      overCents: 0,
      usedPercent: 26,
    });
  });

  it('reports how far spending is past the plan', () => {
    const progress = partProgress(SAMPLE_SPLIT, [spend('a', 'food', -600000)]);

    expect([progress[0].overCents, progress[0].usedPercent]).toEqual([30000, 105]);
  });

  it('ignores income and categories no part has', () => {
    const progress = partProgress(SAMPLE_SPLIT, [
      spend('a', 'food', 5000),
      spend('b', 'health', -9000),
    ]);

    expect(progress.map((item) => item.spentCents)).toEqual([0, 0]);
  });

  it('reads 0% used for a part with nothing planned', () => {
    const progress = partProgress(withBaseIncome(SAMPLE_SPLIT, 0), [spend('a', 'food', -100)]);

    expect([progress[0].plannedCents, progress[0].usedPercent]).toEqual([0, 0]);
  });

  it('tells each part its own spending in the sample month', () => {
    const progress = partProgress(
      { ...SAMPLE_SPLIT, parts: [{ ...FUN, categoryIds: ['health'] }] },
      SAMPLE_OCTOBER,
    );

    expect(progress[0].spentCents).toBe(5890);
  });
});

describe('income read from transactions', () => {
  it('adds up what came in, and what came in under one category', () => {
    const transactions = [
      spend('salary', 'salary', 950000),
      spend('gift', 'extra-income', 20000),
      spend('lunch', 'food', -2500),
    ];

    expect([
      incomeReceivedCents(transactions),
      incomeReceivedIn(transactions, 'salary'),
      incomeReceivedIn(transactions, 'food'),
    ]).toEqual([970000, 950000, 0]);
  });
});

describe('sameSplit', () => {
  it('tells an edited split from the saved one', () => {
    expect([
      sameSplit(SAMPLE_SPLIT, { ...SAMPLE_SPLIT }),
      sameSplit(SAMPLE_SPLIT, withPercent(SAMPLE_SPLIT, 'fun', 11)),
    ]).toEqual([true, false]);
  });
});
