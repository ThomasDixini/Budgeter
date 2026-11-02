import { ParticleKind } from './fire-particle';
import { Size, direction, shorterSide } from './geometry';
import { clamp01, lerp, smoothstep } from './interpolation';
import { Noise2D } from './value-noise';

/** An emitter as its particles see it at one moment. */
export interface EmitterSnapshot {
  readonly x: number;
  readonly y: number;
  /** Direction the plume streams in, in radians (0 = right, π/2 = down). */
  readonly plumeHeading: number;
  /** Colour mix, from 0 (first fire colour) to 1 (second). */
  readonly tint: number;
  /** Fade over the emitter's life, from 0 (silent) to 1. */
  readonly opacity: number;
}

/** What stays fixed for an emitter from birth to death. */
interface EmitterTraits {
  readonly lifetimeSeconds: number;
  /** Drawing-buffer pixels per second. */
  readonly speed: number;
  /** Row of the noise this emitter reads, so each one wanders, sways and changes colour on its own. */
  readonly lane: number;
}

const MIN_LIFETIME_SECONDS = 10;
const MAX_LIFETIME_SECONDS = 20;
/** Share of the life spent fading in, and again fading out, so fires never pop in or out. */
const FADE_SHARE = 0.25;
/** Drift speeds, in shorter screen sides per second; slow, the plume does the visible moving. */
const MIN_SPEED = 0.03;
const MAX_SPEED = 0.07;
/** Fastest turns, in radians per second; the plume sways faster than the fire wanders. */
const MAX_DRIFT_TURN_RATE = 0.5;
const MAX_PLUME_TURN_RATE = 0.9;
/** Noise units per second for steering and colour; low values mean slow changes of mind. */
const STEER_FREQUENCY = 0.15;
const TINT_FREQUENCY = 0.05;
/** Keep the plume and colour samples away from the drift samples on the same lane. */
const PLUME_LANE_OFFSET = 41;
const TINT_LANE_OFFSET = 97;
const LANE_COUNT = 250;
/** Value noise bunches up around 0.5; this window is stretched so both colours show clearly. */
const TINT_LOW = 0.3;
const TINT_HIGH = 0.7;

/** A source of fire that wanders the screen, its plume swaying and its colour shifting as it goes. */
export class FireEmitter {
  /** Fractional particles owed per kind, carried between frames so emission rates stay exact. */
  private readonly emissionDebt = new Map<ParticleKind, number>();

  private constructor(
    private readonly traits: EmitterTraits,
    private x: number,
    private y: number,
    private driftHeading: number,
    private plumeHeading: number,
    private ageSeconds: number,
  ) {}

  /**
   * A new emitter at a random spot; `midLife` starts it part-way through its life, so a freshly
   * filled screen does not fade in all at once.
   * @example FireEmitter.spawn(Math.random, { width: 640, height: 400 }, true)
   */
  static spawn(random: () => number, bounds: Size, midLife: boolean): FireEmitter {
    const traits: EmitterTraits = {
      lifetimeSeconds: lerp(MIN_LIFETIME_SECONDS, MAX_LIFETIME_SECONDS, random()),
      speed: lerp(MIN_SPEED, MAX_SPEED, random()) * shorterSide(bounds),
      lane: random() * LANE_COUNT,
    };
    const ageSeconds = midLife ? random() * traits.lifetimeSeconds : 0;
    const [x, y] = [random() * bounds.width, random() * bounds.height];
    return new FireEmitter(
      traits,
      x,
      y,
      random() * 2 * Math.PI,
      random() * 2 * Math.PI,
      ageSeconds,
    );
  }

  /** Moves the emitter on by `deltaSeconds`; `elapsedSeconds` is the shared clock that drives the steering. */
  step(deltaSeconds: number, elapsedSeconds: number, noise: Noise2D): void {
    const { lane, speed } = this.traits;
    const time = elapsedSeconds * STEER_FREQUENCY;
    this.driftHeading += (noise(lane, time) - 0.5) * 2 * MAX_DRIFT_TURN_RATE * deltaSeconds;
    this.plumeHeading +=
      (noise(lane + PLUME_LANE_OFFSET, time) - 0.5) * 2 * MAX_PLUME_TURN_RATE * deltaSeconds;
    const drift = direction(this.driftHeading);
    this.x += drift.x * speed * deltaSeconds;
    this.y += drift.y * speed * deltaSeconds;
    this.ageSeconds += deltaSeconds;
  }

  /**
   * How many particles of `kind` are due after `weightedSeconds` (time scaled by how strongly the
   * emitter burns); fractions are carried over to the next call.
   * @example emitter.particlesDue(FLAME, 0.1) // 3 at 30 particles per second
   */
  particlesDue(kind: ParticleKind, weightedSeconds: number): number {
    const owed = (this.emissionDebt.get(kind) ?? 0) + kind.ratePerSecond * weightedSeconds;
    const due = Math.floor(owed);
    this.emissionDebt.set(kind, owed - due);
    return due;
  }

  /** True once the emitter has burnt out or drifted off screen. */
  isSpent(bounds: Size): boolean {
    const isOffScreen = this.x < 0 || this.y < 0 || this.x > bounds.width || this.y > bounds.height;
    return this.ageSeconds >= this.traits.lifetimeSeconds || isOffScreen;
  }

  snapshot(elapsedSeconds: number, noise: Noise2D): EmitterSnapshot {
    const tintNoise = noise(this.traits.lane + TINT_LANE_OFFSET, elapsedSeconds * TINT_FREQUENCY);
    return {
      x: this.x,
      y: this.y,
      plumeHeading: this.plumeHeading,
      tint: smoothstep(clamp01((tintNoise - TINT_LOW) / (TINT_HIGH - TINT_LOW))),
      opacity: this.fade(),
    };
  }

  private fade(): number {
    const progress = this.ageSeconds / this.traits.lifetimeSeconds;
    const fadeIn = smoothstep(clamp01(progress / FADE_SHARE));
    const fadeOut = smoothstep(clamp01((1 - progress) / FADE_SHARE));
    return Math.min(fadeIn, fadeOut);
  }
}
