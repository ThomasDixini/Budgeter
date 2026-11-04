import { lerp, smoothstep } from './interpolation';
import { createSeededRandom } from './seeded-random';

/** Smooth 2D noise that can be sampled at any real coordinate; returns values in `[0, 1]`. */
export type Noise2D = (x: number, y: number) => number;

const LATTICE_SIZE = 256;
const LATTICE_MASK = LATTICE_SIZE - 1;

/**
 * Seeded value noise: random values on an integer lattice, blended smoothly in between,
 * so the same seed always draws the same fire.
 * @example createValueNoise(7)(1.5, 2.25) // a value in [0, 1]
 */
export function createValueNoise(seed: number): Noise2D {
  const random = createSeededRandom(seed);
  const values = Float32Array.from({ length: LATTICE_SIZE }, () => random());
  const permutation = shuffledIndexes(random);
  const valueAt = (x: number, y: number): number =>
    values[permutation[(permutation[x & LATTICE_MASK] + y) & LATTICE_MASK]];
  return (x, y) => blendCorners(valueAt, x, y);
}

function blendCorners(valueAt: (x: number, y: number) => number, x: number, y: number): number {
  const left = Math.floor(x);
  const bottom = Math.floor(y);
  const across = smoothstep(x - left);
  const lower = lerp(valueAt(left, bottom), valueAt(left + 1, bottom), across);
  const upper = lerp(valueAt(left, bottom + 1), valueAt(left + 1, bottom + 1), across);
  return lerp(lower, upper, smoothstep(y - bottom));
}

function shuffledIndexes(random: () => number): Uint8Array {
  const indexes = Uint8Array.from({ length: LATTICE_SIZE }, (_, index) => index);
  for (let index = LATTICE_SIZE - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [indexes[index], indexes[swap]] = [indexes[swap], indexes[index]];
  }
  return indexes;
}
