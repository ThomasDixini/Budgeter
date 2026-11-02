import { EmitterSnapshot } from './fire-emitter';
import { PlanePoint, direction } from './geometry';
import { clamp01, lerp, smoothstep } from './interpolation';

/** Swirl direction (a unit vector) at a point in drawing-buffer pixels. */
export type FlowSampler = (x: number, y: number) => PlanePoint;

type Range = readonly [number, number];

/** How one kind of particle looks and moves; lengths are in shorter screen sides. */
export interface ParticleKind {
  readonly ratePerSecond: number;
  readonly lifetimeSeconds: Range;
  /** Speed along the plume, per second. */
  readonly speed: Range;
  /** Widest angle off the plume heading, either side, in radians. */
  readonly spread: number;
  readonly startRadius: Range;
  readonly endRadius: number;
  /** How far ahead of the emitter, along the plume, the particle is born. */
  readonly birthOffset: number;
  /** Random scatter around the birth point; widens the base so it is not a single bright dot. */
  readonly birthScatter: number;
  readonly peakAlpha: number;
  /** Share of the life spent fading in; the rest fades out with `fadeOutPower`. */
  readonly fadeInShare: number;
  readonly fadeOutPower: number;
  /** How hard the swirl pushes the particle, per second. */
  readonly flowInfluence: number;
  /** Whiteness at birth, cooling to none; hot flames start pale, smoke never is. */
  readonly heat: number;
}

/**
 * Warm, dense and fairly short-lived. Many large, faint, heavily overlapping puffs melt into one
 * continuous tongue; shrinking as they fly tapers it to a point, and the steep fade-out hides them
 * before they are small enough to read as separate specks.
 */
export const FLAME: ParticleKind = {
  ratePerSecond: 70,
  lifetimeSeconds: [1.6, 2.6],
  speed: [0.2, 0.32],
  spread: 0.12,
  startRadius: [0.07, 0.11],
  endRadius: 0.035,
  birthOffset: 0,
  birthScatter: 0.04,
  peakAlpha: 0.055,
  fadeInShare: 0.25,
  fadeOutPower: 1.3,
  flowInfluence: 0.1,
  heat: 0.35,
};

/** Very faint, slow and long-lived; it billows out ahead of the flames and curls with the swirl. */
export const SMOKE: ParticleKind = {
  ratePerSecond: 10,
  lifetimeSeconds: [3.5, 6],
  speed: [0.05, 0.1],
  spread: 0.5,
  startRadius: [0.1, 0.14],
  endRadius: 0.35,
  birthOffset: 0.3,
  birthScatter: 0.08,
  peakAlpha: 0.045,
  fadeInShare: 0.3,
  fadeOutPower: 1.2,
  flowInfluence: 0.12,
  heat: 0,
};

/** A particle as the stage draws it; lengths are in drawing-buffer pixels. */
export interface ParticleSnapshot {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** Colour mix, from 0 (first fire colour) to 1 (second). */
  readonly tint: number;
  /** How far the colour is pushed towards white. */
  readonly heat: number;
  readonly alpha: number;
}

/** What stays fixed for a particle from birth to death. */
interface ParticleTraits {
  readonly lifetimeSeconds: number;
  readonly startRadius: number;
  readonly tint: number;
  /** The emitter's strength at birth, so fading fires leave fainter trails. */
  readonly strength: number;
  /** Drawing-buffer pixels per shorter screen side. */
  readonly scale: number;
}

/** One puff of flame or smoke, flying out along the plume and drifting with the swirl. */
export class FireParticle {
  private ageSeconds = 0;

  private constructor(
    private readonly kind: ParticleKind,
    private readonly traits: ParticleTraits,
    private position: PlanePoint,
    private readonly velocity: PlanePoint,
  ) {}

  /**
   * A new particle leaving `source`, spread a little around its plume heading. `headStartSeconds`
   * moves it on as if born earlier in the frame: particles born together would otherwise fly as
   * clumps, which reads as falling snow instead of a flowing flame.
   * @example FireParticle.emit(FLAME, emitter.snapshot(t, noise), Math.random, 400, 0.01)
   */
  static emit(
    kind: ParticleKind,
    source: EmitterSnapshot,
    random: () => number,
    scale: number,
    headStartSeconds: number,
  ): FireParticle {
    const heading = direction(source.plumeHeading + (random() * 2 - 1) * kind.spread);
    const speed = between(kind.speed, random()) * scale;
    const traits: ParticleTraits = {
      lifetimeSeconds: between(kind.lifetimeSeconds, random()),
      startRadius: between(kind.startRadius, random()) * scale,
      tint: source.tint,
      strength: source.opacity,
      scale,
    };
    const position = birthPoint(kind, source, random, scale);
    const velocity = { x: heading.x * speed, y: heading.y * speed };
    const particle = new FireParticle(kind, traits, position, velocity);
    particle.coast(headStartSeconds);
    return particle;
  }

  /** Moves the particle on by `deltaSeconds`, pushed by the swirl at its position. */
  step(deltaSeconds: number, flowAt: FlowSampler): void {
    const flow = flowAt(this.position.x, this.position.y);
    const push = this.kind.flowInfluence * this.traits.scale;
    this.position = {
      x: this.position.x + (this.velocity.x + flow.x * push) * deltaSeconds,
      y: this.position.y + (this.velocity.y + flow.y * push) * deltaSeconds,
    };
    this.ageSeconds += deltaSeconds;
  }

  /** Moves on by its own velocity alone; used for the head start, too short for the swirl to matter. */
  private coast(seconds: number): void {
    this.position = {
      x: this.position.x + this.velocity.x * seconds,
      y: this.position.y + this.velocity.y * seconds,
    };
    this.ageSeconds += seconds;
  }

  isSpent(): boolean {
    return this.ageSeconds >= this.traits.lifetimeSeconds;
  }

  snapshot(): ParticleSnapshot {
    const progress = clamp01(this.ageSeconds / this.traits.lifetimeSeconds);
    const endRadius = this.kind.endRadius * this.traits.scale;
    return {
      x: this.position.x,
      y: this.position.y,
      radius: lerp(this.traits.startRadius, endRadius, progress),
      tint: this.traits.tint,
      heat: this.kind.heat * (1 - progress),
      alpha: this.alphaAt(progress),
    };
  }

  private alphaAt(progress: number): number {
    const fadeIn = smoothstep(clamp01(progress / this.kind.fadeInShare));
    const fadeOut = (1 - progress) ** this.kind.fadeOutPower;
    return this.kind.peakAlpha * this.traits.strength * fadeIn * fadeOut;
  }
}

function between([low, high]: Range, amount: number): number {
  return lerp(low, high, amount);
}

/** A little ahead of the emitter along its plume, scattered so the base is a soft patch, not a dot. */
function birthPoint(
  kind: ParticleKind,
  source: EmitterSnapshot,
  random: () => number,
  scale: number,
): PlanePoint {
  const plume = direction(source.plumeHeading);
  const ahead = kind.birthOffset * scale;
  const scatter = kind.birthScatter * scale;
  return {
    x: source.x + plume.x * ahead + (random() - 0.5) * scatter,
    y: source.y + plume.y * ahead + (random() - 0.5) * scatter,
  };
}
