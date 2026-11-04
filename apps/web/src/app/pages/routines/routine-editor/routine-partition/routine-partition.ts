import { Component, computed, input, signal } from '@angular/core';
import { formatDuration } from '../../../../core/calendar/time-of-day';
import { Category, findCategory, withAlpha } from '../../../../core/routines/category';
import {
  Routine,
  dailyMinutesByCategory,
  hourTicks,
  scheduleIssues,
} from '../../../../core/routines/routine';
import { partitionLaneCount, partitionSegments } from '../../../../core/routines/routine-edits';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

/** Height of one lane of the bar; overlapping blocks add lanes and the bar grows. */
const LANE_HEIGHT = 34;
/** Gutter above and below the lanes. */
const BAR_GUTTER = 8;
/** Narrower segments (in percent of the day) are too small for their name: it moves to the tooltip. */
const MIN_NAMED_WIDTH = 7;
/** The tooltip's middle stays this far (in percent) from the bar's ends, so it is never cut off. */
const TOOLTIP_EDGE_MIN = 8;
const TOOLTIP_EDGE_MAX = 92;
const UNCATEGORIZED_FILL = 'rgba(255, 255, 255, 0.10)';
const UNCATEGORIZED_BORDER = 'rgba(255, 255, 255, 0.22)';

interface SegmentView {
  readonly key: string;
  readonly name: string;
  readonly range: string;
  readonly category?: Category;
  /** Name, category and time in one line, read out by screen readers. */
  readonly summary: string;
  readonly showsName: boolean;
  readonly left: number;
  readonly width: number;
  readonly top: number;
  readonly height: number;
  readonly background: string;
  readonly border: string;
}

interface LegendEntry {
  readonly category: Category;
  readonly duration: string;
}

/**
 * Horizontal bar showing how the routine day is split: each block a strip in its category's color,
 * named when it is wide enough, over hour lines; a legend below totals the time per category.
 * Overlapping blocks stack in lanes so each stays visible.
 */
@Component({
  selector: 'app-routine-partition',
  imports: [TranslatePipe],
  templateUrl: './routine-partition.html',
  styleUrl: './routine-partition.css',
  host: { '(document:click)': 'unpinOutsideBlocks($event)' },
})
export class RoutinePartition {
  readonly routine = input.required<Routine>();
  readonly categories = input.required<readonly Category[]>();

  /** The block under the mouse or holding the keyboard focus. */
  protected readonly focusedKey = signal<string | undefined>(undefined);
  /** The block tapped (or clicked): it stays pointed out until tapped again or something else is. */
  protected readonly pinnedKey = signal<string | undefined>(undefined);
  /**
   * The block whose details show, whose category the bar and legend point out: the tapped one, else
   * the hovered or focused one. Found by key among the current segments, so a block edited or
   * deleted meanwhile never leaves a stale tooltip.
   */
  protected readonly shown = computed(() => {
    const keys = [this.pinnedKey(), this.focusedKey()];
    for (const key of keys) {
      const segment = this.segments().find((candidate) => candidate.key === key);
      if (segment !== undefined) return segment;
    }
    return undefined;
  });
  /** Category of the shown block; null for a block without one. */
  protected readonly shownCategoryId = computed(() => {
    const segment = this.shown();
    return segment === undefined ? undefined : (segment.category?.id ?? null);
  });
  /** Where the tooltip points: the middle of the shown block, kept clear of the bar's edges. */
  protected readonly tooltipLeft = computed(() => {
    const segment = this.shown();
    if (segment === undefined) return 0;
    return Math.min(TOOLTIP_EDGE_MAX, Math.max(TOOLTIP_EDGE_MIN, segment.left + segment.width / 2));
  });

  protected togglePinned(key: string): void {
    this.pinnedKey.update((pinned) => (pinned === key ? undefined : key));
  }

  /** A tap anywhere but on a block lets go of the pinned one, as there is no mouse to move away. */
  protected unpinOutsideBlocks(event: Event): void {
    const target = event.target;
    if (target instanceof Element && target.closest('.segment') !== null) return;
    this.pinnedKey.set(undefined);
  }

  protected readonly barHeight = computed(
    () => partitionLaneCount(this.routine()) * LANE_HEIGHT + BAR_GUTTER,
  );
  protected readonly ticks = computed(() => hourTicks(this.routine()));
  protected readonly issues = computed(() => scheduleIssues(this.routine().blocks).join(' · '));
  protected readonly segments = computed(() =>
    partitionSegments(this.routine()).map(({ block, ...placement }): SegmentView => {
      const category = findCategory(this.categories(), block.categoryId);
      return {
        name: block.name,
        range: `${block.start}–${block.end}`,
        category,
        summary: [block.name, category?.name, `${block.start}–${block.end}`]
          .filter(Boolean)
          .join(' · '),
        showsName: placement.width >= MIN_NAMED_WIDTH,
        ...placement,
        background: category ? withAlpha(category.color, 0.45) : UNCATEGORIZED_FILL,
        border: category ? withAlpha(category.color, 0.85) : UNCATEGORIZED_BORDER,
      };
    }),
  );
  protected readonly legend = computed(() =>
    dailyMinutesByCategory(this.routine()).flatMap(([categoryId, minutes]): LegendEntry[] => {
      const category = findCategory(this.categories(), categoryId);
      return category === undefined ? [] : [{ category, duration: formatDuration(minutes) }];
    }),
  );
}
