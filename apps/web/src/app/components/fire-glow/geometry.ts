export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface PlanePoint {
  readonly x: number;
  readonly y: number;
}

/**
 * The shorter side of an area; sizes and speeds scale with it so phones and monitors look alike.
 * @example shorterSide({ width: 640, height: 400 }) // 400
 */
export function shorterSide(size: Size): number {
  return Math.min(size.width, size.height);
}

/**
 * Unit vector pointing at `angle` radians (0 = right, π/2 = down, as on a canvas).
 * @example direction(0) // { x: 1, y: 0 }
 */
export function direction(angle: number): PlanePoint {
  return { x: Math.cos(angle), y: Math.sin(angle) };
}
