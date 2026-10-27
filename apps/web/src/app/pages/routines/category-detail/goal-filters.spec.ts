import { SAMPLE_GOALS } from '../../../core/routines/sample-routines';
import { matchesFilters, periodFilterOptions } from './goal-filters';

const studyGoals = SAMPLE_GOALS.filter((goal) => goal.categoryId === 'study');

describe('matchesFilters', () => {
  it('lets every goal through with both filters on all', () => {
    expect(studyGoals.every((goal) => matchesFilters(goal, 'all', 'all'))).toBe(true);
  });

  it('keeps only goals of the chosen period and type', () => {
    const matches = studyGoals.filter((goal) => matchesFilters(goal, 'weekly', 'frequency'));

    expect(matches.map((goal) => goal.id)).toEqual(['g1']);
  });
});

describe('periodFilterOptions', () => {
  it('counts goals per period', () => {
    const counts = periodFilterOptions(studyGoals, 'all').map((option) => option.count);

    expect(counts).toEqual([3, 1, 1, 0, 0, 1]);
  });

  it('respects the type filter in the counts', () => {
    expect(periodFilterOptions(studyGoals, 'objective')[0]).toEqual({
      value: 'all',
      label: 'All',
      count: 1,
    });
  });
});
