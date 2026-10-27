import { formatClock, formatDuration, minutesOfDay, toMinutes, weekdayIndex } from './time-of-day';

describe('toMinutes', () => {
  it('converts a clock time to minutes since midnight', () => {
    expect(toMinutes('13:30')).toBe(810);
  });

  it('rejects a malformed clock time', () => {
    expect(() => toMinutes('25:00')).toThrow('"25:00"');
  });
});

describe('formatClock', () => {
  it('pads hours and minutes', () => {
    expect(formatClock(65)).toBe('01:05');
  });

  it('clamps values past the end of the day', () => {
    expect(formatClock(2000)).toBe('23:59');
  });
});

describe('formatDuration', () => {
  it('shows hours and minutes', () => {
    expect(formatDuration(450)).toBe('7h30');
  });

  it('drops the minutes on whole hours', () => {
    expect(formatDuration(120)).toBe('2h');
  });
});

describe('minutesOfDay', () => {
  it('reads the minutes since midnight of a moment', () => {
    expect(minutesOfDay(new Date(2026, 9, 26, 14, 10))).toBe(850);
  });
});

describe('weekdayIndex', () => {
  it('starts the week on Monday', () => {
    expect(weekdayIndex(new Date(2026, 9, 26))).toBe(0);
  });

  it('ends the week on Sunday', () => {
    expect(weekdayIndex(new Date(2026, 10, 1))).toBe(6);
  });
});
