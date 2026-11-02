import { ParticleSnapshot } from './fire-particle';
import { Size } from './geometry';

/** The fire being animated; `FireSystem` is the real one. */
export interface FireSimulation {
  resize(bounds: Size): void;
  advance(deltaSeconds: number): void;
  snapshot(): readonly ParticleSnapshot[];
}

/** Where the fire is shown; the browser version wraps a 2D canvas. */
export interface FireStage {
  /** Size of the element on screen, in CSS pixels. */
  readonly widthPx: number;
  readonly heightPx: number;
  /** Matches the drawing buffer to `size`, in buffer pixels. */
  resize(size: Size): void;
  draw(particles: readonly ParticleSnapshot[]): void;
}

/** Calls back before the next repaint; the browser version wraps `requestAnimationFrame`. */
export interface FrameScheduler {
  request(callback: (nowMs: number) => void): number;
  cancel(request: number): void;
}

/** Drawing at about a third of the resolution is invisible under the heavy blur and cuts the fill cost ~8×. */
const RESOLUTION_SCALE = 0.35;
/** The fire moves slowly, so 30 fps looks the same as 60 for half the work. */
const FRAME_INTERVAL_MS = 1000 / 30;
/** Longest step simulated at once, so a tab coming back from the background does not make the fire jump. */
const MAX_STEP_SECONDS = 0.1;
/** Simulated before the first frame, so the page opens on a burning fire instead of an empty screen. */
const WARM_UP_STEPS = 30;
const MS_PER_SECOND = 1000;

/** Keeps a stage showing the fire: fits it to the element, moves the fire and redraws on frames. */
export class FireAnimation {
  private size: Size = { width: 0, height: 0 };
  private frameRequest = 0;
  private lastPaintMs = -Infinity;

  constructor(
    private readonly stage: FireStage,
    private readonly fire: FireSimulation,
    private readonly scheduler: FrameScheduler,
  ) {
    this.fitStage();
  }

  /**
   * Starts the loop, or draws one still frame when motion should be avoided.
   * @example animation.start(matchMedia('(prefers-reduced-motion: reduce)').matches)
   */
  start(isStill: boolean): void {
    for (let step = 0; step < WARM_UP_STEPS; step++) {
      this.fire.advance(MAX_STEP_SECONDS);
    }
    if (isStill) {
      this.draw();
      return;
    }
    this.frameRequest = this.scheduler.request(this.tick);
  }

  stop(): void {
    this.scheduler.cancel(this.frameRequest);
  }

  private readonly tick = (nowMs: number): void => {
    this.frameRequest = this.scheduler.request(this.tick);
    const elapsedMs = nowMs - this.lastPaintMs;
    if (elapsedMs < FRAME_INTERVAL_MS) {
      return;
    }
    this.lastPaintMs = nowMs;
    this.fire.advance(Math.min(MAX_STEP_SECONDS, elapsedMs / MS_PER_SECOND));
    this.draw();
  };

  private draw(): void {
    this.fitStage();
    this.stage.draw(this.fire.snapshot());
  }

  private fitStage(): void {
    const width = Math.round(this.stage.widthPx * RESOLUTION_SCALE);
    const height = Math.round(this.stage.heightPx * RESOLUTION_SCALE);
    if (width === this.size.width && height === this.size.height) {
      return;
    }
    this.size = { width, height };
    this.stage.resize(this.size);
    this.fire.resize(this.size);
  }
}
