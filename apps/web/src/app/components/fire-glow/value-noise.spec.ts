import { createValueNoise } from './value-noise';

const SAMPLE_POINTS: readonly (readonly [number, number])[] = Array.from(
  { length: 200 },
  (_, index) => [index * 0.37, index * -0.53],
);

describe('createValueNoise', () => {
  it('draws the same values for the same seed', () => {
    const first = createValueNoise(7);
    const second = createValueNoise(7);

    expect(first(1.5, 2.25)).toBe(second(1.5, 2.25));
  });

  it('draws different values for a different seed', () => {
    const values = SAMPLE_POINTS.map(([x, y]) => createValueNoise(7)(x, y));
    const otherValues = SAMPLE_POINTS.map(([x, y]) => createValueNoise(8)(x, y));

    expect(values).not.toEqual(otherValues);
  });

  it('stays within zero and one, negative coordinates included', () => {
    const noise = createValueNoise(3);

    const values = SAMPLE_POINTS.map(([x, y]) => noise(x, y));

    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThanOrEqual(1);
  });

  it('changes smoothly between nearby points', () => {
    const noise = createValueNoise(3);

    const step = Math.abs(noise(4.5, 1.25) - noise(4.501, 1.25));

    expect(step).toBeLessThan(0.01);
  });
});
