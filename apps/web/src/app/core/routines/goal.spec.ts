import {
  Goal,
  averageProgress,
  goalFooter,
  goalPeriodInfo,
  goalProgress,
  goalTag,
  goalValueLabel,
  parseIsoDate,
  periodFooter,
  usesDots,
} from './goal';

const TODAY = new Date(2026, 9, 26);

const weeklyGoal: Goal = {
  id: 'g1',
  categoryId: 'study',
  title: 'Study C# 5x a week',
  type: 'frequency',
  period: 'weekly',
  done: 3,
  target: 5,
};

describe('goalProgress', () => {
  it('is the share of the target reached', () => {
    expect(goalProgress(weeklyGoal)).toBe(60);
  });

  it('caps at 100', () => {
    expect(goalProgress({ done: 7, target: 5 })).toBe(100);
  });
});

describe('averageProgress', () => {
  it('averages the progress of the goals', () => {
    expect(
      averageProgress([
        { done: 1, target: 2 },
        { done: 2, target: 2 },
      ]),
    ).toBe(75);
  });

  it('is zero without goals', () => {
    expect(averageProgress([])).toBe(0);
  });
});

describe('usesDots', () => {
  it('draws small frequency goals as dots', () => {
    expect(usesDots(weeklyGoal)).toBe(true);
  });

  it('draws objectives as a bar', () => {
    expect(usesDots({ type: 'objective', target: 5 })).toBe(false);
  });

  it('draws long frequency goals as a bar', () => {
    expect(usesDots({ type: 'frequency', target: 11 })).toBe(false);
  });
});

describe('goal labels', () => {
  it('tags the type and period', () => {
    expect(goalTag(weeklyGoal)).toBe('Frequency · Weekly');
  });

  it('counts repetitions for frequency goals', () => {
    expect(goalValueLabel({ ...weeklyGoal, target: 1, done: 0 })).toBe('0 of 1 time');
  });

  it('counts units for objectives', () => {
    expect(goalValueLabel({ type: 'objective', done: 4, target: 12, unit: 'modules' })).toBe(
      '4 of 12 modules',
    );
  });

  it('falls back to the first period for an unknown value', () => {
    expect(goalPeriodInfo('bogus' as Goal['period']).value).toBe('daily');
  });
});

describe('goalFooter', () => {
  it('says completed once the target is reached', () => {
    expect(goalFooter({ ...weeklyGoal, done: 5 }, TODAY)).toBe('Completed');
  });

  it('says when a pending goal renews', () => {
    expect(goalFooter(weeklyGoal, TODAY)).toBe('Renews on Sunday');
  });
});

describe('periodFooter', () => {
  it.each([
    ['daily', 'Renews every day'],
    ['monthly', 'Renews on Nov 1'],
    ['yearly', 'until Dec 31'],
  ] as const)('describes the %s period', (period, footer) => {
    expect(periodFooter(period, TODAY)).toBe(footer);
  });

  it('shows the deadline of a custom period', () => {
    expect(periodFooter('custom', TODAY, '2026-12-15')).toBe('until Dec 15');
  });

  it('is empty for a custom period without deadline', () => {
    expect(periodFooter('custom', TODAY)).toBe('');
  });
});

describe('parseIsoDate', () => {
  it('reads the date in local time', () => {
    expect(parseIsoDate('2026-12-15')).toEqual(new Date(2026, 11, 15));
  });
});
