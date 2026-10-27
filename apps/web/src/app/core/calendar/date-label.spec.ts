import { longDateLabel } from './date-label';

describe('longDateLabel', () => {
  it('spells out the weekday, month and day', () => {
    expect(longDateLabel(new Date(2026, 9, 26), 'en-US')).toBe('Monday, October 26');
  });
});
