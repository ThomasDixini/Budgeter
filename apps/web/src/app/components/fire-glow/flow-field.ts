import { PlanePoint, direction } from './geometry';
import { Noise2D } from './value-noise';

/** Noise cycles per shorter screen side; low, so the swirls are broad, lazy eddies. */
const FLOW_FREQUENCY = 1.5;
/** Noise units per second the swirl pattern shifts by, so eddies form and dissolve over time. */
const FLOW_DRIFT = 0.15;
/** Full turns the direction can sweep across the noise range; above 1 lets eddies close into curls. */
const FLOW_TURNS = 2;
/** Keeps the swirl samples away from the steering samples so the two do not correlate. */
const FLOW_NOISE_OFFSET = 300;

/**
 * Swirl direction (a unit vector) at a point measured in shorter screen sides; smoke and flames
 * drift along it, which curls their trails.
 * @example flowAt(createValueNoise(1), 0.5, 0.5, 3) // { x: 0.6…, y: -0.8… }
 */
export function flowAt(noise: Noise2D, x: number, y: number, seconds: number): PlanePoint {
  const value = noise(
    x * FLOW_FREQUENCY + FLOW_NOISE_OFFSET,
    y * FLOW_FREQUENCY + seconds * FLOW_DRIFT,
  );
  return direction(value * FLOW_TURNS * 2 * Math.PI);
}
