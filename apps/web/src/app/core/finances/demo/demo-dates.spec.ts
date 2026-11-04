import { addDays, addMonths, dayOfMonth, daysBetweenDays, monthEnd } from './demo-dates';

describe('demo dates', () => {
  it('moves days and months across month and year ends', () => {
    expect([
      addDays('2026-11-03', -3),
      addDays('2026-12-30', 3),
      addMonths('2026-01-15', -2),
      addMonths('2026-11-15', 3),
    ]).toEqual(['2026-10-31', '2027-01-02', '2025-11', '2027-02']);
  });

  it('finds the day of a month, or its last day when the month is shorter', () => {
    expect([dayOfMonth('2026-02', 31), dayOfMonth('2026-03', 10), monthEnd('2024-02')]).toEqual([
      '2026-02-28',
      '2026-03-10',
      '2024-02-29',
    ]);
  });

  it('counts the days between two days', () => {
    expect([
      daysBetweenDays('2026-11-01', '2026-11-04'),
      daysBetweenDays('2026-11-04', '2026-11-01'),
    ]).toEqual([3, -3]);
  });
});
