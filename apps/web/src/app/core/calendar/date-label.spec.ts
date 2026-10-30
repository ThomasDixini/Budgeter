import { isoDate, longDateLabel } from './date-label';

describe('longDateLabel', () => {
  it('spells out the weekday, month and day', () => {
    expect(longDateLabel(new Date(2026, 9, 26), 'en-US')).toBe('Monday, October 26');
  });
});

describe('isoDate', () => {
  it('keeps the local calendar day late at night', () => {
    expect(isoDate(new Date(2026, 9, 26, 23, 30))).toBe('2026-10-26');
  });
});
