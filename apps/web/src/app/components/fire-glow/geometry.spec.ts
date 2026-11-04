import { direction, shorterSide } from './geometry';

describe('shorterSide', () => {
  it('picks the height of a landscape screen', () => {
    expect(shorterSide({ width: 640, height: 400 })).toBe(400);
  });

  it('picks the width of a portrait screen', () => {
    expect(shorterSide({ width: 188, height: 406 })).toBe(188);
  });
});

describe('direction', () => {
  it('points right at zero', () => {
    expect(direction(0)).toEqual({ x: 1, y: 0 });
  });

  it('points down a quarter turn later, as on a canvas', () => {
    const down = direction(Math.PI / 2);

    expect(down.x).toBeCloseTo(0);
    expect(down.y).toBeCloseTo(1);
  });
});
