import { clamp01, lerp, smoothstep } from './interpolation';

describe('clamp01', () => {
  it('caps values above one', () => {
    expect(clamp01(1.4)).toBe(1);
  });

  it('raises values below zero', () => {
    expect(clamp01(-0.2)).toBe(0);
  });

  it('keeps values inside the range', () => {
    expect(clamp01(0.3)).toBe(0.3);
  });
});

describe('lerp', () => {
  it('blends proportionally between the two ends', () => {
    expect(lerp(10, 20, 0.25)).toBe(12.5);
  });
});

describe('smoothstep', () => {
  it('keeps the ends and the midpoint in place', () => {
    expect([smoothstep(0), smoothstep(0.5), smoothstep(1)]).toEqual([0, 0.5, 1]);
  });

  it('starts slower than a straight line', () => {
    expect(smoothstep(0.1)).toBeLessThan(0.1);
  });
});
