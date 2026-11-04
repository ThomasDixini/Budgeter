import { FireStage } from './fire-animation';
import { ParticleSnapshot } from './fire-particle';
import { Rgb, mixRgb, toRgba, whiten } from './flame-palette';
import { Size } from './geometry';

/** Opacity across a particle, centre (0) to edge (1); the soft falloff is what makes puffs merge. */
const OPACITY_STOPS: readonly (readonly [number, number])[] = [
  [0, 1],
  [0.4, 0.55],
  [1, 0],
];
const FULL_TURN = 2 * Math.PI;

/** Draws fire particles on a 2D canvas as soft puffs; overlapping puffs add up into bright flame. */
export class CanvasFireStage implements FireStage {
  constructor(
    private readonly context: CanvasRenderingContext2D,
    private readonly firstColor: Rgb,
    private readonly secondColor: Rgb,
  ) {}

  get widthPx(): number {
    return this.context.canvas.clientWidth;
  }

  get heightPx(): number {
    return this.context.canvas.clientHeight;
  }

  resize(size: Size): void {
    this.context.canvas.width = size.width;
    this.context.canvas.height = size.height;
  }

  draw(particles: readonly ParticleSnapshot[]): void {
    const { width, height } = this.context.canvas;
    this.context.clearRect(0, 0, width, height);
    this.context.globalCompositeOperation = 'lighter';
    for (const particle of particles) {
      this.drawPuff(particle);
    }
  }

  private drawPuff({ x, y, radius, tint, heat, alpha }: ParticleSnapshot): void {
    const color = whiten(mixRgb(this.firstColor, this.secondColor, tint), heat);
    const gradient = this.context.createRadialGradient(x, y, 0, x, y, radius);
    for (const [offset, strength] of OPACITY_STOPS) {
      gradient.addColorStop(offset, toRgba(color, alpha * strength));
    }
    this.context.fillStyle = gradient;
    this.context.beginPath();
    this.context.arc(x, y, radius, 0, FULL_TURN);
    this.context.fill();
  }
}
