import { BlockOutcome } from './day-plan';
import { goalsMetOn, goalsShortOn, historyBlocks, historyPeriodLabel } from './day-history';
import { Goal } from './goal';
import { SAMPLE_CATEGORIES, SAMPLE_ROUTINES } from './sample-routines';

const OUTCOMES: readonly BlockOutcome[] = [
  { routineId: 'weekdays', blockId: 'network', outcome: 'skipped', at: '16:00' },
  { routineId: 'weekdays', blockId: 'csharp', outcome: 'done', at: '14:50' },
  { routineId: 'gone', blockId: 'old', outcome: 'done', at: '09:00' },
];

const WEEKLY: Goal = {
  id: 'g1',
  categoryId: 'study',
  title: 'Study C# 5x a week',
  type: 'frequency',
  period: 'weekly',
  done: 6,
  target: 5,
};
const SHORT: Goal = { ...WEEKLY, id: 'g4', done: 2 };
const OBJECTIVE: Goal = {
  id: 'g2',
  categoryId: 'study',
  title: 'Finish the C# course',
  type: 'objective',
  period: 'custom',
  done: 1,
  target: 1,
  deadline: '2026-12-15',
  achievedOn: '2026-10-27',
};

describe('historyBlocks', () => {
  it('lists the blocks of the day in the order they ended, with their names and categories', () => {
    const blocks = historyBlocks(OUTCOMES, SAMPLE_ROUTINES, SAMPLE_CATEGORIES);

    expect(blocks.map((block) => [block.at, block.name, block.outcome])).toEqual([
      ['09:00', 'Removed block', 'done'],
      ['14:50', 'C# study', 'done'],
      ['16:00', 'Networking', 'skipped'],
    ]);
    expect(blocks[1].category?.name).toBe('Study');
    expect(blocks[1].routineName).toBe('Weekdays');
  });
});

describe('goalsMetOn', () => {
  it('keeps frequency goals that reached their target and objectives achieved that very day', () => {
    const met = goalsMetOn([WEEKLY, SHORT, OBJECTIVE], '2026-10-27');

    expect(met.map((goal) => goal.id)).toEqual(['g1', 'g2']);
  });

  it('leaves out an objective achieved on an earlier day', () => {
    expect(goalsMetOn([OBJECTIVE], '2026-10-28')).toEqual([]);
  });
});

describe('goalsShortOn', () => {
  it('keeps the frequency goals still short of their target', () => {
    expect(goalsShortOn([WEEKLY, SHORT, OBJECTIVE]).map((goal) => goal.id)).toEqual(['g4']);
  });
});

describe('historyPeriodLabel', () => {
  it.each([
    ['daily', 'Oct 28'],
    ['weekly', 'Week of Oct 26'],
    ['monthly', 'October 2026'],
    ['yearly', '2026'],
  ] as const)('names the %s period around the day', (period, label) => {
    expect(historyPeriodLabel(period, '2026-10-28')).toBe(label);
  });

  it('names a custom period by its deadline', () => {
    expect(historyPeriodLabel('custom', '2026-10-28', '2026-12-15')).toBe('Until Dec 15');
  });
});
