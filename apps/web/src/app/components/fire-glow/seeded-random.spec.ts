import { createSeededRandom } from './seeded-random';

function draw(seed: number, count: number): number[] {
  const random = createSeededRandom(seed);
  return Array.from({ length: count }, () => random());
}

describe('createSeededRandom', () => {
  it('repeats the same sequence for the same seed', () => {
    expect(draw(42, 5)).toEqual(draw(42, 5));
  });

  it('gives a different sequence for a different seed', () => {
    expect(draw(42, 5)).not.toEqual(draw(43, 5));
  });

  it('stays within zero (inclusive) and one (exclusive)', () => {
    const values = draw(9, 1000);

    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
  });
});
