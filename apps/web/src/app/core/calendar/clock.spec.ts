import { Clock } from './clock';
import { FixedClock } from './fixed-clock';

describe('Clock', () => {
  it('reports the current time', () => {
    const before = Date.now();

    const now = new Clock().now().getTime();

    expect(now).toBeGreaterThanOrEqual(before);
  });
});

describe('FixedClock', () => {
  it('always reports the moment it was given', () => {
    const moment = new Date(2026, 9, 26, 9);

    const clock = new FixedClock(moment);

    expect(clock.now()).toEqual(moment);
  });

  it('hands out copies so callers cannot move its time', () => {
    const clock = new FixedClock(new Date(2026, 9, 26, 9));

    clock.now().setFullYear(2000);

    expect(clock.now().getFullYear()).toBe(2026);
  });
});
