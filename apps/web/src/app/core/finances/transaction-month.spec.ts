import { defaultDayIn, monthLabel, monthOf, monthOfDay, shiftMonth } from './transaction-month';

describe('monthOf', () => {
  it('keeps the local month late on its last night', () => {
    expect(monthOf(new Date(2026, 9, 31, 23, 50))).toBe('2026-10');
  });
});

describe('monthOfDay', () => {
  it('cuts the day off an ISO date', () => {
    expect(monthOfDay('2026-10-31')).toBe('2026-10');
  });
});

describe('shiftMonth', () => {
  it.each([
    ['2026-12', 1, '2027-01'],
    ['2026-01', -1, '2025-12'],
    ['2026-10', 0, '2026-10'],
  ])('moves %s by %d to %s', (month, step, expected) => {
    expect(shiftMonth(month, step)).toBe(expected);
  });
});

describe('monthLabel', () => {
  it('spells out the month and year', () => {
    expect(monthLabel('2026-10', 'en-US')).toBe('October 2026');
  });
});

describe('defaultDayIn', () => {
  it('starts on today in the current month', () => {
    expect(defaultDayIn('2026-10', '2026-10-31')).toBe('2026-10-31');
  });

  it('starts on the first day of another month', () => {
    expect(defaultDayIn('2026-09', '2026-10-31')).toBe('2026-09-01');
  });
});
