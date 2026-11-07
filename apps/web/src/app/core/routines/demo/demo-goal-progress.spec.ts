import { BlockOutcome } from '../day-plan';
import { Goal } from '../goal';
import { Routine } from '../routine';
import { completedInPeriod, periodRange } from './demo-goal-progress';

const ROUTINES: readonly Routine[] = [
  {
    id: 'routine',
    name: 'Routine',
    days: [0, 1, 2, 3, 4, 5, 6],
    start: '08:00',
    end: '18:00',
    blocks: [
      { id: 'study', name: 'Study', start: '08:00', end: '10:00', categoryId: 'study' },
      { id: 'walk', name: 'Walk', start: '10:00', end: '11:00', categoryId: 'exercise' },
    ],
  },
];

const GOAL: Goal = {
  id: 'g',
  categoryId: 'study',
  title: 'Study',
  type: 'frequency',
  period: 'weekly',
  done: 0,
  target: 3,
};

function outcome(blockId: string, kind: BlockOutcome['outcome']): BlockOutcome {
  return { routineId: 'routine', blockId, outcome: kind, at: '10:00' };
}

describe('periodRange', () => {
  it.each([
    ['daily', '2026-11-04', '2026-11-04'],
    ['weekly', '2026-11-02', '2026-11-08'],
    ['monthly', '2026-11-01', '2026-11-30'],
    ['yearly', '2026-01-01', '2026-12-31'],
  ] as const)('covers the %s period around Wednesday, November 4', (period, from, to) => {
    expect(periodRange({ period }, '2026-11-04')).toEqual({ from, to });
  });

  it('ends a custom period on its deadline', () => {
    const range = periodRange({ period: 'custom', deadline: '2026-12-15' }, '2026-11-04');

    expect(range.to).toBe('2026-12-15');
  });
});

describe('completedInPeriod', () => {
  it('counts only completed blocks of the goal category inside the period', () => {
    const outcomes = new Map<string, readonly BlockOutcome[]>([
      ['2026-11-02', [outcome('study', 'done'), outcome('walk', 'done')]],
      ['2026-11-03', [outcome('study', 'skipped')]],
      ['2026-11-04', [outcome('study', 'done')]],
      ['2026-10-30', [outcome('study', 'done')]],
    ]);

    expect(completedInPeriod(GOAL, '2026-11-04', ROUTINES, outcomes)).toBe(2);
  });
});
