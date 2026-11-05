import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

/** One line of the chart; a missing value leaves a gap. */
export interface ChartSeries {
  readonly name: string;
  readonly values: readonly (number | undefined)[];
  readonly dashed?: boolean;
}

interface Tick {
  readonly y: number;
  readonly label: string;
}

interface DrawnLine {
  readonly name: string;
  readonly path: string;
  readonly areaPath: string;
  readonly dashed: boolean;
  readonly index: number;
}

const WIDTH = 420;
const HEIGHT = 190;
const PAD_LEFT = 46;
const PAD_RIGHT = 10;
const PAD_TOP = 10;
const PAD_BOTTOM = 24;
const TICK_COUNT = 4;

/**
 * A small line chart drawn in SVG, with a legend and an empty state for when there is nothing to plot.
 * @example <app-line-chart title="Value" [labels]="months" [series]="lines" [format]="money" emptyText="No history yet" />
 */
@Component({
  selector: 'app-line-chart',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './line-chart.html',
  styleUrl: './line-chart.css',
})
export class LineChart {
  readonly title = input.required<string>();
  readonly labels = input.required<readonly string[]>();
  readonly series = input.required<readonly ChartSeries[]>();
  readonly format = input.required<(value: number) => string>();
  readonly emptyText = input.required<string>();

  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;
  protected readonly bottom = HEIGHT - PAD_BOTTOM;
  protected readonly left = PAD_LEFT;
  protected readonly right = WIDTH - PAD_RIGHT;

  protected readonly hasData = computed(() =>
    this.series().some((line) => line.values.some((value) => value !== undefined)),
  );
  protected readonly bounds = computed(() => this.valueBounds());
  protected readonly ticks = computed<Tick[]>(() => this.buildTicks());
  protected readonly lines = computed<DrawnLine[]>(() =>
    this.series().map((line, index) => this.draw(line, index)),
  );
  protected readonly columns = computed(() =>
    this.labels().map((label, index) => ({ label, x: this.xOf(index) })),
  );

  private valueBounds(): { min: number; max: number } {
    const values = this.series()
      .flatMap((line) => line.values)
      .filter((value): value is number => value !== undefined);
    if (values.length === 0) return { min: 0, max: 1 };
    const min = Math.min(...values);
    const max = Math.max(...values);
    return min === max ? { min: min - 1, max: max + 1 } : { min, max };
  }

  private buildTicks(): Tick[] {
    const { min, max } = this.bounds();
    return Array.from({ length: TICK_COUNT + 1 }, (_, step) => {
      const value = min + ((max - min) * step) / TICK_COUNT;
      return { y: this.yOf(value), label: this.format()(value) };
    });
  }

  private draw(line: ChartSeries, index: number): DrawnLine {
    const points = line.values
      .map((value, position) => (value === undefined ? undefined : this.point(position, value)))
      .filter((point): point is string => point !== undefined);
    const path = points.length === 0 ? '' : `M${points.join(' L')}`;
    return {
      name: line.name,
      path,
      areaPath: this.area(points),
      dashed: line.dashed ?? false,
      index,
    };
  }

  private area(points: readonly string[]): string {
    if (points.length < 2) return '';
    const firstX = points[0].split(',')[0];
    const lastX = points[points.length - 1].split(',')[0];
    return `M${points.join(' L')} L${lastX},${this.bottom} L${firstX},${this.bottom} Z`;
  }

  private point(position: number, value: number): string {
    return `${this.xOf(position).toFixed(1)},${this.yOf(value).toFixed(1)}`;
  }

  private xOf(position: number): number {
    const steps = Math.max(this.labels().length - 1, 1);
    return PAD_LEFT + ((WIDTH - PAD_LEFT - PAD_RIGHT) * position) / steps;
  }

  private yOf(value: number): number {
    const { min, max } = this.bounds();
    const span = HEIGHT - PAD_TOP - PAD_BOTTOM;
    return PAD_TOP + span - ((value - min) / (max - min)) * span;
  }
}
