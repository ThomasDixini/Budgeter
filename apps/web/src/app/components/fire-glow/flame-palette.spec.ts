import { Rgb, mixRgb, parseRgbTriplet, toRgba, whiten } from './flame-palette';

const MINT: Rgb = { red: 46, green: 242, blue: 166 };
const VIOLET: Rgb = { red: 139, green: 92, blue: 246 };

describe('parseRgbTriplet', () => {
  it('reads a design-token triplet, spaces included', () => {
    expect(parseRgbTriplet(' 46, 242, 166')).toEqual(MINT);
  });

  it('names the offending value when the triplet is malformed', () => {
    expect(() => parseRgbTriplet('#2ef2a6')).toThrow('got "#2ef2a6"');
  });
});

describe('mixRgb', () => {
  it('returns the first colour at zero', () => {
    expect(mixRgb(MINT, VIOLET, 0)).toEqual(MINT);
  });

  it('returns the second colour at one', () => {
    expect(mixRgb(MINT, VIOLET, 1)).toEqual(VIOLET);
  });

  it('blends each channel in between', () => {
    expect(mixRgb(MINT, VIOLET, 0.5).green).toBe(167);
  });
});

describe('whiten', () => {
  it('moves every channel towards white', () => {
    expect(whiten({ red: 0, green: 100, blue: 255 }, 0.5)).toEqual({
      red: 127.5,
      green: 177.5,
      blue: 255,
    });
  });
});

describe('toRgba', () => {
  it('formats a canvas colour with rounded channels', () => {
    expect(toRgba({ red: 46.4, green: 241.6, blue: 166 }, 0.5)).toBe('rgba(46, 242, 166, 0.5)');
  });
});
