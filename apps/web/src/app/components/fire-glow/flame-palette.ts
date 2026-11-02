import { lerp } from './interpolation';

export interface Rgb {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

const CHANNEL_MAX = 255;
const WHITE: Rgb = { red: CHANNEL_MAX, green: CHANNEL_MAX, blue: CHANNEL_MAX };

/**
 * Reads a design-token triplet such as `--color-mint-rgb`.
 * @example parseRgbTriplet('46, 242, 166') // { red: 46, green: 242, blue: 166 }
 */
export function parseRgbTriplet(value: string): Rgb {
  const channels = value.split(',').map((channel) => Number(channel.trim()));
  if (channels.length !== 3 || channels.some((channel) => !Number.isFinite(channel))) {
    throw new Error(`Expected an "r, g, b" triplet such as "46, 242, 166", got "${value}"`);
  }
  const [red, green, blue] = channels;
  return { red, green, blue };
}

/**
 * Blends two colours; `amount` 0 gives `from`, 1 gives `to`.
 * @example mixRgb(black, white, 0.5) // { red: 127.5, green: 127.5, blue: 127.5 }
 */
export function mixRgb(from: Rgb, to: Rgb, amount: number): Rgb {
  return {
    red: lerp(from.red, to.red, amount),
    green: lerp(from.green, to.green, amount),
    blue: lerp(from.blue, to.blue, amount),
  };
}

/**
 * Moves a colour towards white, like the pale core of a flame.
 * @example whiten({ red: 0, green: 0, blue: 0 }, 1) // white
 */
export function whiten(color: Rgb, amount: number): Rgb {
  return mixRgb(color, WHITE, amount);
}

/**
 * CSS colour string for canvas fills, channels rounded to whole numbers.
 * @example toRgba({ red: 46, green: 242, blue: 166 }, 0.5) // 'rgba(46, 242, 166, 0.5)'
 */
export function toRgba(color: Rgb, alpha: number): string {
  const channels = [color.red, color.green, color.blue].map(Math.round).join(', ');
  return `rgba(${channels}, ${alpha})`;
}
