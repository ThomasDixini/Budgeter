import { FireAnimation, FireSimulation, FireStage, FrameScheduler } from './fire-animation';
import { ParticleSnapshot } from './fire-particle';
import { Size } from './geometry';

const PUFF: ParticleSnapshot = { x: 1, y: 2, radius: 3, tint: 0, heat: 0, alpha: 0.5 };

class FakeFireStage implements FireStage {
  readonly sizes: string[] = [];
  drawCount = 0;

  constructor(
    public widthPx: number,
    public heightPx: number,
  ) {}

  resize(size: Size): void {
    this.sizes.push(`${size.width}x${size.height}`);
  }

  draw(): void {
    this.drawCount++;
  }
}

class FakeFireSimulation implements FireSimulation {
  readonly sizes: string[] = [];
  readonly steps: number[] = [];

  resize(bounds: Size): void {
    this.sizes.push(`${bounds.width}x${bounds.height}`);
  }

  advance(deltaSeconds: number): void {
    this.steps.push(deltaSeconds);
  }

  snapshot(): readonly ParticleSnapshot[] {
    return [PUFF];
  }
}

class FakeFrameScheduler implements FrameScheduler {
  readonly cancelled: number[] = [];
  private pending: ((nowMs: number) => void) | undefined;
  private lastRequest = 0;

  request(callback: (nowMs: number) => void): number {
    this.pending = callback;
    return ++this.lastRequest;
  }

  cancel(request: number): void {
    this.cancelled.push(request);
  }

  hasPendingFrame(): boolean {
    return this.pending !== undefined;
  }

  runFrame(nowMs: number): void {
    const callback = this.pending;
    this.pending = undefined;
    callback?.(nowMs);
  }
}

function setUp(): {
  stage: FakeFireStage;
  fire: FakeFireSimulation;
  scheduler: FakeFrameScheduler;
  animation: FireAnimation;
} {
  const stage = new FakeFireStage(1280, 800);
  const fire = new FakeFireSimulation();
  const scheduler = new FakeFrameScheduler();
  return { stage, fire, scheduler, animation: new FireAnimation(stage, fire, scheduler) };
}

describe('FireAnimation', () => {
  it('fits the stage and the fire at about a third of the on-screen resolution', () => {
    const { stage, fire } = setUp();

    expect([...stage.sizes, ...fire.sizes]).toEqual(['448x280', '448x280']);
  });

  it('warms the fire up before the first frame', () => {
    const { fire, animation } = setUp();

    animation.start(false);

    expect(fire.steps).toEqual(Array(30).fill(0.1));
  });

  it('draws a single still frame and schedules nothing when motion is reduced', () => {
    const { stage, scheduler, animation } = setUp();

    animation.start(true);

    expect(stage.drawCount).toBe(1);
    expect(scheduler.hasPendingFrame()).toBe(false);
  });

  it('skips frames that come sooner than the frame interval', () => {
    const { stage, scheduler, animation } = setUp();
    animation.start(false);

    scheduler.runFrame(1000);
    scheduler.runFrame(1010);
    scheduler.runFrame(1050);

    expect(stage.drawCount).toBe(2);
  });

  it('never simulates more than a tenth of a second at once', () => {
    const { fire, scheduler, animation } = setUp();
    animation.start(false);

    scheduler.runFrame(1000);
    scheduler.runFrame(60000);

    expect(fire.steps.at(-1)).toBe(0.1);
  });

  it('refits when the element changes size', () => {
    const { stage, fire, scheduler, animation } = setUp();
    animation.start(false);

    stage.widthPx = 600;
    scheduler.runFrame(1000);

    expect(fire.sizes).toEqual(['448x280', '210x280']);
  });

  it('cancels the pending frame when stopped', () => {
    const { scheduler, animation } = setUp();
    animation.start(false);

    animation.stop();

    expect(scheduler.cancelled).toEqual([1]);
  });
});
