import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';
import { CanvasFireStage } from './canvas-fire-stage';
import { FireAnimation, FrameScheduler } from './fire-animation';
import { FireSystem } from './fire-system';
import { parseRgbTriplet } from './flame-palette';
import { createSeededRandom } from './seeded-random';
import { createValueNoise } from './value-noise';

/** Any fixed seed works; fixing it makes every visit start from the same fire. */
const FIRE_SEED = 1729;

const browserFrames: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (request) => cancelAnimationFrame(request),
};

/** Soft flames and smoke drifting loose across the whole screen; set `opacity` on the host to dim them. */
@Component({
  selector: 'app-fire-glow',
  template: `<canvas #canvas class="canvas"></canvas>`,
  styleUrl: './fire-glow.css',
  host: { 'aria-hidden': 'true' },
})
export class FireGlow {
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => this.startAnimation());
  }

  /** Test DOMs have no 2D canvas; the fire is decoration, so it simply stays off there. */
  private startAnimation(): void {
    const canvas = this.canvas().nativeElement;
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    const fire = new FireSystem(createSeededRandom(FIRE_SEED), createValueNoise(FIRE_SEED));
    const animation = new FireAnimation(this.createStage(context), fire, browserFrames);
    animation.start(matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.destroyRef.onDestroy(() => animation.stop());
  }

  private createStage(context: CanvasRenderingContext2D): CanvasFireStage {
    const tokens = getComputedStyle(context.canvas);
    return new CanvasFireStage(
      context,
      parseRgbTriplet(tokens.getPropertyValue('--color-mint-rgb')),
      parseRgbTriplet(tokens.getPropertyValue('--color-violet-deep-rgb')),
    );
  }
}
