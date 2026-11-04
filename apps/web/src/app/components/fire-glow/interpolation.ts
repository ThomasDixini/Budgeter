/**
 * Limits a value to the `[0, 1]` range.
 * @example clamp01(1.4) // 1
 */
export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Straight-line blend from `from` (amount 0) to `to` (amount 1).
 * @example lerp(10, 20, 0.25) // 12.5
 */
export function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

/**
 * Eases an amount in `[0, 1]` so blends start and end without a visible kink.
 * @example smoothstep(0.5) // 0.5
 */
export function smoothstep(amount: number): number {
  return amount * amount * (3 - 2 * amount);
}
