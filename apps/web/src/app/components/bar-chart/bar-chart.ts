import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

interface Bar {
  readonly label: string;
  /** Left edge of the slot the bar sits in, which is what can be clicked. */
  readonly slotX: number;
  readonly x: number;
  readonly y: number;
  readonly height: number;
  readonly isNegative: boolean;
  readonly description: string;
}

interface Tick {
  readonly y: number;
  readonly label: string;
}

const WIDTH = 420;
const HEIGHT = 190;
const PAD_LEFT = 46;
const PAD_RIGHT = 10;
const PAD_TOP = 10;
const PAD_BOTTOM = 24;
const TICK_COUNT = 4;
const BAR_FILL = 0.6;

/**
 * A small bar chart drawn in SVG; bars below zero take the second color. Shows a message when every
 * value is zero.
 * @example <app-bar-chart title="Proventos" [labels]="months" [values]="cents" [format]="money" emptyText="None yet" />
 */
@Component({
  selector: 'app-bar-chart',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bar-chart.html',
  styleUrl: './bar-chart.css',
})
export class BarChart {
  readonly title = input.required<string>();
  readonly note = input<string>('');
  readonly labels = input.required<readonly string[]>();
  readonly values = input.required<readonly number[]>();
  readonly format = input.required<(value: number) => string>();
  readonly emptyText = input.required<string>();
  readonly positiveLabel = input<string>('');
  readonly negativeLabel = input<string>('');
  /** Whether a bar can be picked, with the mouse or the keyboard. */
  readonly selectable = input(false);
  /** The bar picked, if any; the page owns the choice and passes it back. */
  readonly selectedIndex = input<number | undefined>(undefined);
  readonly pick = output<number>();

  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;
  protected readonly left = PAD_LEFT;
  protected readonly right = WIDTH - PAD_RIGHT;

  protected readonly hasData = computed(() => this.values().some((value) => value !== 0));
  protected readonly bounds = computed(() => this.valueBounds());
  protected readonly ticks = computed<Tick[]>(() => this.buildTicks());
  protected readonly barWidth = computed(() => this.slotWidth() * BAR_FILL);
  protected readonly slot = computed(() => this.slotWidth());
  protected readonly bars = computed<Bar[]>(() =>
    this.values().map((value, index) => this.buildBar(value, index)),
  );

  private valueBounds(): { min: number; max: number } {
    const max = Math.max(0, ...this.values());
    const min = Math.min(0, ...this.values());
    return max === min ? { min: 0, max: 1 } : { min, max };
  }

  private buildTicks(): Tick[] {
    const { min, max } = this.bounds();
    return Array.from({ length: TICK_COUNT + 1 }, (_, step) => {
      const value = min + ((max - min) * step) / TICK_COUNT;
      return { y: this.yOf(value), label: this.format()(value) };
    });
  }

  private buildBar(value: number, index: number): Bar {
    const slot = this.slotWidth();
    const label = this.labels()[index] ?? '';
    return {
      label,
      slotX: PAD_LEFT + slot * index,
      x: PAD_LEFT + slot * index + (slot * (1 - BAR_FILL)) / 2,
      y: Math.min(this.yOf(value), this.yOf(0)),
      height: Math.abs(this.yOf(value) - this.yOf(0)),
      isNegative: value < 0,
      description: `${label}: ${this.format()(value)}`,
    };
  }

  private slotWidth(): number {
    return (WIDTH - PAD_LEFT - PAD_RIGHT) / Math.max(this.values().length, 1);
  }

  private yOf(value: number): number {
    const { min, max } = this.bounds();
    const span = HEIGHT - PAD_TOP - PAD_BOTTOM;
    return PAD_TOP + span - ((value - min) / (max - min)) * span;
  }
}
