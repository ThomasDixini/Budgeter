import { EmitterSnapshot, FireEmitter } from './fire-emitter';
import { FLAME } from './fire-particle';
import { Size } from './geometry';
import { createSeededRandom } from './seeded-random';
import { createValueNoise } from './value-noise';

const BOUNDS: Size = { width: 640, height: 400 };
const NOISE = createValueNoise(1729);

function spawnEmitter(midLife = false): FireEmitter {
  return FireEmitter.spawn(createSeededRandom(5), BOUNDS, midLife);
}

function runFor(emitter: FireEmitter, seconds: number): void {
  for (let elapsed = 0.1; elapsed <= seconds + 1e-9; elapsed += 0.1) {
    emitter.step(0.1, elapsed, NOISE);
  }
}

function snapshotAfter(seconds: number): EmitterSnapshot {
  const emitter = spawnEmitter();
  runFor(emitter, seconds);
  return emitter.snapshot(seconds, NOISE);
}

describe('FireEmitter', () => {
  it('appears somewhere on the screen', () => {
    const { x, y } = spawnEmitter().snapshot(0, NOISE);

    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThanOrEqual(BOUNDS.width);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(BOUNDS.height);
  });

  it('starts silent and fades in', () => {
    expect(spawnEmitter().snapshot(0, NOISE).opacity).toBe(0);
    expect(snapshotAfter(3).opacity).toBeGreaterThan(0);
  });

  it('starts part-way through its life when asked to', () => {
    expect(spawnEmitter(true).snapshot(0, NOISE).opacity).toBeGreaterThan(0);
  });

  it('wanders over time', () => {
    const start = spawnEmitter().snapshot(0, NOISE);
    const later = snapshotAfter(2);

    expect(Math.hypot(later.x - start.x, later.y - start.y)).toBeGreaterThan(0);
  });

  it('keeps swinging its plume in new directions', () => {
    expect(snapshotAfter(5).plumeHeading).not.toBe(spawnEmitter().snapshot(0, NOISE).plumeHeading);
  });

  it('keeps its colour mix between the two colours', () => {
    const tints = [0, 10, 20, 40].map((seconds) => spawnEmitter().snapshot(seconds, NOISE).tint);

    expect(Math.min(...tints)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...tints)).toBeLessThanOrEqual(1);
  });

  it('emits at its rate, carrying fractions between frames', () => {
    const emitter = spawnEmitter();

    const due = Array.from({ length: 10 }, () => emitter.particlesDue(FLAME, 0.1));

    expect(due.reduce((total, count) => total + count, 0)).toBe(FLAME.ratePerSecond);
  });

  it('is not spent while young', () => {
    expect(spawnEmitter().isSpent(BOUNDS)).toBe(false);
  });

  it('burns out after its lifetime', () => {
    const emitter = spawnEmitter();

    runFor(emitter, 21);

    expect(emitter.isSpent(BOUNDS)).toBe(true);
  });
});
