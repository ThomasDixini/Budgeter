import { flowAt } from './flow-field';
import { createValueNoise } from './value-noise';

const NOISE = createValueNoise(1729);
const POINTS = Array.from({ length: 30 }, (_, index) => [index * 0.13, index * 0.07] as const);

describe('flowAt', () => {
  it('always points with unit strength', () => {
    const lengths = POINTS.map(([x, y]) => {
      const flow = flowAt(NOISE, x, y, 2);
      return Math.hypot(flow.x, flow.y);
    });

    lengths.forEach((length) => expect(length).toBeCloseTo(1));
  });

  it('points different ways in different places', () => {
    const headings = POINTS.map(([x, y]) => flowAt(NOISE, x, y, 2).x);

    expect(Math.min(...headings)).toBeLessThan(0);
    expect(Math.max(...headings)).toBeGreaterThan(0);
  });

  it('shifts over time', () => {
    expect(flowAt(NOISE, 0.5, 0.5, 0)).not.toEqual(flowAt(NOISE, 0.5, 0.5, 5));
  });
});
