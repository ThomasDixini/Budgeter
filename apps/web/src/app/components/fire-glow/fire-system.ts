import { FireSimulation } from './fire-animation';
import { FireEmitter } from './fire-emitter';
import { FLAME, FireParticle, ParticleKind, ParticleSnapshot, SMOKE } from './fire-particle';
import { flowAt } from './flow-field';
import { Size, shorterSide } from './geometry';
import { Noise2D } from './value-noise';

/** Drawing-buffer pixels of screen per emitter; sets how crowded the fire looks on any screen. */
const AREA_PER_EMITTER = 22000;
const MIN_EMITTERS = 3;
const MAX_EMITTERS = 7;
const PARTICLE_KINDS: readonly ParticleKind[] = [FLAME, SMOKE];

/** The whole fire: wandering emitters, the flame and smoke they give off, and the swirl moving it all. */
export class FireSystem implements FireSimulation {
  private emitters: FireEmitter[] = [];
  private particles: FireParticle[] = [];
  private bounds: Size = { width: 0, height: 0 };
  private elapsed = 0;

  constructor(
    private readonly random: () => number,
    private readonly noise: Noise2D,
  ) {}

  /**
   * Fits the fire to a new screen size; existing emitters keep burning, missing ones appear mid-life.
   * @example fire.resize({ width: 640, height: 400 })
   */
  resize(bounds: Size): void {
    this.bounds = bounds;
    const count = emitterCount(bounds);
    this.emitters = this.emitters.slice(0, count);
    while (this.emitters.length < count) {
      this.emitters.push(FireEmitter.spawn(this.random, bounds, true));
    }
  }

  /** Moves everything on by `deltaSeconds`: emitters wander and emit, particles fly and burn out. */
  advance(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;
    this.advanceEmitters(deltaSeconds);
    this.advanceParticles(deltaSeconds);
  }

  snapshot(): ParticleSnapshot[] {
    return this.particles.map((particle) => particle.snapshot());
  }

  private advanceEmitters(deltaSeconds: number): void {
    this.emitters = this.emitters.map((emitter) => {
      emitter.step(deltaSeconds, this.elapsed, this.noise);
      this.emitFrom(emitter, deltaSeconds);
      return emitter.isSpent(this.bounds)
        ? FireEmitter.spawn(this.random, this.bounds, false)
        : emitter;
    });
  }

  private emitFrom(emitter: FireEmitter, deltaSeconds: number): void {
    const source = emitter.snapshot(this.elapsed, this.noise);
    const scale = shorterSide(this.bounds);
    for (const kind of PARTICLE_KINDS) {
      const due = emitter.particlesDue(kind, deltaSeconds * source.opacity);
      for (let index = 0; index < due; index++) {
        const headStart = this.random() * deltaSeconds;
        this.particles.push(FireParticle.emit(kind, source, this.random, scale, headStart));
      }
    }
  }

  private advanceParticles(deltaSeconds: number): void {
    const scale = shorterSide(this.bounds);
    const swirl = (x: number, y: number) => flowAt(this.noise, x / scale, y / scale, this.elapsed);
    for (const particle of this.particles) {
      particle.step(deltaSeconds, swirl);
    }
    this.particles = this.particles.filter((particle) => !particle.isSpent());
  }
}

/**
 * How many fires burn at once on a screen of this size (in drawing-buffer pixels).
 * @example emitterCount({ width: 448, height: 280 }) // 6
 */
export function emitterCount(bounds: Size): number {
  const fitting = Math.round((bounds.width * bounds.height) / AREA_PER_EMITTER);
  return Math.min(MAX_EMITTERS, Math.max(MIN_EMITTERS, fitting));
}
