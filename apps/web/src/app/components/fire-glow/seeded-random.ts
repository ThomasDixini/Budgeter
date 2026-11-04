/**
 * Repeatable random numbers in `[0, 1)` (Mulberry32): tiny and good enough for visuals, and unlike
 * Math.random the same seed always gives the same fire, which keeps the tests repeatable.
 * @example createSeededRandom(7)() // the same value on every run
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}
