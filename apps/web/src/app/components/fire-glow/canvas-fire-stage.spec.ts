import { CanvasFireStage } from './canvas-fire-stage';
import { ParticleSnapshot } from './fire-particle';

class FakeGradient {
  readonly stops: [number, string][] = [];

  addColorStop(offset: number, color: string): void {
    this.stops.push([offset, color]);
  }
}

/** Stands in for a 2D context, which the test DOM does not implement; records what was drawn. */
class FakeCanvasContext {
  readonly canvas = { width: 300, height: 150, clientWidth: 640, clientHeight: 480 };
  readonly gradients: FakeGradient[] = [];
  readonly operations: string[] = [];
  globalCompositeOperation = 'source-over';
  fillStyle: FakeGradient | string = '';

  clearRect(): void {
    this.operations.push('clear');
  }

  createRadialGradient(): FakeGradient {
    const gradient = new FakeGradient();
    this.gradients.push(gradient);
    return gradient;
  }

  beginPath(): void {
    this.operations.push('begin');
  }

  arc(): void {
    this.operations.push('arc');
  }

  fill(): void {
    this.operations.push(`fill:${this.globalCompositeOperation}`);
  }
}

const PUFF: ParticleSnapshot = { x: 100, y: 50, radius: 20, tint: 0, heat: 0, alpha: 0.5 };
const MINT = { red: 46, green: 242, blue: 166 };
const VIOLET = { red: 139, green: 92, blue: 246 };

function drawPuffs(...particles: ParticleSnapshot[]): FakeCanvasContext {
  const context = new FakeCanvasContext();
  createStage(context).draw(particles);
  return context;
}

function createStage(context: FakeCanvasContext): CanvasFireStage {
  return new CanvasFireStage(context as unknown as CanvasRenderingContext2D, MINT, VIOLET);
}

describe('CanvasFireStage', () => {
  it('reports the on-screen size of the canvas', () => {
    const stage = createStage(new FakeCanvasContext());

    expect([stage.widthPx, stage.heightPx]).toEqual([640, 480]);
  });

  it('resizes the drawing buffer', () => {
    const context = new FakeCanvasContext();

    createStage(context).resize({ width: 320, height: 240 });

    expect([context.canvas.width, context.canvas.height]).toEqual([320, 240]);
  });

  it('clears the previous frame before drawing', () => {
    expect(drawPuffs(PUFF).operations[0]).toBe('clear');
  });

  it('fills one puff per particle, adding up where they overlap', () => {
    const fills = drawPuffs(PUFF, PUFF, PUFF).operations.filter((step) => step.startsWith('fill'));

    expect(fills).toEqual(Array(3).fill('fill:lighter'));
  });

  it('colours the puff from its tint, solid at the centre and clear at the edge', () => {
    const [stops] = drawPuffs({ ...PUFF, tint: 1 }).gradients.map((gradient) => gradient.stops);

    expect(stops[0]).toEqual([0, 'rgba(139, 92, 246, 0.5)']);
    expect(stops.at(-1)).toEqual([1, 'rgba(139, 92, 246, 0)']);
  });

  it('whitens hot puffs', () => {
    const [stops] = drawPuffs({ ...PUFF, heat: 1 }).gradients.map((gradient) => gradient.stops);

    expect(stops[0][1]).toBe('rgba(255, 255, 255, 0.5)');
  });
});
