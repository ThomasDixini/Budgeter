import { EmitterSnapshot } from './fire-emitter';
import { FLAME, FireParticle, FlowSampler, ParticleKind, SMOKE } from './fire-particle';
import { createSeededRandom } from './seeded-random';

const SCALE = 400;
/** Plume pointing right, so "along the plume" is simply +x. */
const SOURCE: EmitterSnapshot = { x: 100, y: 200, plumeHeading: 0, tint: 0.25, opacity: 1 };
const STILL_AIR: FlowSampler = () => ({ x: 0, y: 0 });
const DOWNWARD_SWIRL: FlowSampler = () => ({ x: 0, y: 1 });

function emitParticle(
  kind: ParticleKind,
  source: EmitterSnapshot = SOURCE,
  headStartSeconds = 0,
): FireParticle {
  return FireParticle.emit(kind, source, createSeededRandom(3), SCALE, headStartSeconds);
}

function stepFor(particle: FireParticle, seconds: number, flow = STILL_AIR): void {
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += 0.1) {
    particle.step(0.1, flow);
  }
}

describe('FireParticle', () => {
  it('is born at the emitter, scattered a little', () => {
    const { x, y } = emitParticle(FLAME).snapshot();

    expect(Math.abs(x - SOURCE.x)).toBeLessThanOrEqual((FLAME.birthScatter * SCALE) / 2);
    expect(Math.abs(y - SOURCE.y)).toBeLessThanOrEqual((FLAME.birthScatter * SCALE) / 2);
  });

  it('is born ahead of the flames when it is smoke', () => {
    const { x } = emitParticle(SMOKE).snapshot();

    expect(x).toBeGreaterThan(SOURCE.x + SMOKE.birthOffset * SCALE - SMOKE.birthScatter * SCALE);
  });

  it('flies out along the plume', () => {
    const particle = emitParticle(FLAME);
    const start = particle.snapshot();

    stepFor(particle, 0.5);

    expect(particle.snapshot().x).toBeGreaterThan(start.x);
  });

  it('starts further along when given a head start, so a frame’s particles do not clump', () => {
    const onTime = emitParticle(FLAME).snapshot();
    const early = emitParticle(FLAME, SOURCE, 0.05).snapshot();

    expect(early.x).toBeGreaterThan(onTime.x);
    expect(early.alpha).toBeGreaterThan(onTime.alpha);
  });

  it('is carried by the swirl', () => {
    const calm = emitParticle(SMOKE);
    const swirled = emitParticle(SMOKE);

    stepFor(calm, 1);
    stepFor(swirled, 1, DOWNWARD_SWIRL);

    expect(swirled.snapshot().y).toBeGreaterThan(calm.snapshot().y);
  });

  it('shrinks into a point when it is flame', () => {
    const particle = emitParticle(FLAME);
    const startRadius = particle.snapshot().radius;

    stepFor(particle, 1);

    expect(particle.snapshot().radius).toBeLessThan(startRadius);
  });

  it('billows out when it is smoke', () => {
    const particle = emitParticle(SMOKE);
    const startRadius = particle.snapshot().radius;

    stepFor(particle, 1);

    expect(particle.snapshot().radius).toBeGreaterThan(startRadius);
  });

  it('starts hot and cools down', () => {
    const particle = emitParticle(FLAME);

    stepFor(particle, 1);

    expect(particle.snapshot().heat).toBeLessThan(FLAME.heat);
  });

  it('fades in from nothing at birth', () => {
    const particle = emitParticle(FLAME);
    const atBirth = particle.snapshot().alpha;

    stepFor(particle, 0.3);

    expect(atBirth).toBe(0);
    expect(particle.snapshot().alpha).toBeGreaterThan(0);
  });

  it('is fainter when its emitter is fading', () => {
    const full = emitParticle(FLAME);
    const faint = emitParticle(FLAME, { ...SOURCE, opacity: 0.5 });

    stepFor(full, 0.3);
    stepFor(faint, 0.3);

    expect(faint.snapshot().alpha).toBeCloseTo(full.snapshot().alpha / 2);
  });

  it('keeps the colour of the emitter that gave it off', () => {
    expect(emitParticle(SMOKE).snapshot().tint).toBe(0.25);
  });

  it('burns out after its lifetime', () => {
    const particle = emitParticle(FLAME);

    stepFor(particle, FLAME.lifetimeSeconds[1] + 0.1);

    expect(particle.isSpent()).toBe(true);
  });
});
