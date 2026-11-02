import { FireSystem, emitterCount } from './fire-system';
import { createSeededRandom } from './seeded-random';
import { createValueNoise } from './value-noise';

function createFire(): FireSystem {
  const fire = new FireSystem(createSeededRandom(1729), createValueNoise(1729));
  fire.resize({ width: 640, height: 400 });
  return fire;
}

function runFor(fire: FireSystem, seconds: number): void {
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += 0.1) {
    fire.advance(0.1);
  }
}

describe('emitterCount', () => {
  it('fits the number of fires to the screen area', () => {
    expect(emitterCount({ width: 448, height: 280 })).toBe(6);
  });

  it('keeps a few fires on small screens', () => {
    expect(emitterCount({ width: 131, height: 284 })).toBe(3);
  });

  it('caps the fires on huge screens', () => {
    expect(emitterCount({ width: 2000, height: 1200 })).toBe(7);
  });
});

describe('FireSystem', () => {
  it('has nothing to draw before any time has passed', () => {
    expect(createFire().snapshot()).toEqual([]);
  });

  it('gives off flame and smoke as time passes', () => {
    const fire = createFire();

    runFor(fire, 2);

    expect(fire.snapshot().length).toBeGreaterThan(0);
  });

  it('keeps burning as fires burn out and new ones start', () => {
    const fire = createFire();

    runFor(fire, 60);

    expect(fire.snapshot().length).toBeGreaterThan(0);
  });

  it('lets particles burn out instead of piling up', () => {
    const fire = createFire();

    runFor(fire, 60);

    expect(fire.snapshot().length).toBeLessThan(2000);
  });

  it('keeps the fire as it is when the size is unchanged', () => {
    const fire = createFire();
    runFor(fire, 1);
    const before = fire.snapshot();

    fire.resize({ width: 640, height: 400 });

    expect(fire.snapshot()).toEqual(before);
  });

  it('burns the same way for the same seed', () => {
    const first = createFire();
    const second = createFire();

    runFor(first, 3);
    runFor(second, 3);

    expect(first.snapshot()).toEqual(second.snapshot());
  });
});
