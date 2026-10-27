import { Component, computed, input } from '@angular/core';
import { formatClock } from '../../../../core/calendar/time-of-day';
import { Category, findCategory, withAlpha } from '../../../../core/routines/category';
import {
  nowLineOffset,
  timelineBlocks,
  timelineHeight,
  timelineHours,
} from '../../../../core/routines/day-timeline';
import { Routine } from '../../../../core/routines/routine';

interface TimelineBlockView {
  readonly id: string;
  readonly name: string;
  readonly range: string;
  readonly top: number;
  readonly height: number;
  readonly isNow: boolean;
  readonly category?: Category;
  readonly background: string;
  readonly border: string;
}

const NEUTRAL_BACKGROUND = 'rgba(255, 255, 255, 0.035)';
const NEUTRAL_BORDER = 'rgba(255, 255, 255, 0.10)';
const NOW_BORDER = 'rgba(46, 242, 166, 0.6)';

/** Vertical hour grid of today's routine with its blocks and a live "now" line. */
@Component({
  selector: 'app-day-timeline',
  templateUrl: './day-timeline.html',
  styleUrl: './day-timeline.css',
})
export class DayTimeline {
  readonly routine = input.required<Routine>();
  readonly categories = input.required<readonly Category[]>();
  readonly nowMinutes = input.required<number>();

  protected readonly height = computed(() => timelineHeight(this.routine()));
  protected readonly hours = computed(() => timelineHours(this.routine()));
  protected readonly nowOffset = computed(() => nowLineOffset(this.routine(), this.nowMinutes()));
  protected readonly nowLabel = computed(() => formatClock(this.nowMinutes()));
  protected readonly blocks = computed(() =>
    timelineBlocks(this.routine(), this.nowMinutes()).map(({ block, top, height, isNow }) => {
      const category = findCategory(this.categories(), block.categoryId);
      return {
        id: block.id,
        name: block.name,
        range: `${block.start} – ${block.end}`,
        top,
        height,
        isNow,
        category,
        ...this.blockColors(category, isNow),
      } satisfies TimelineBlockView;
    }),
  );

  private blockColors(
    category: Category | undefined,
    isNow: boolean,
  ): Pick<TimelineBlockView, 'background' | 'border'> {
    const background = category ? withAlpha(category.color, 0.07) : NEUTRAL_BACKGROUND;
    if (isNow) return { background, border: NOW_BORDER };
    return { background, border: category ? withAlpha(category.color, 0.28) : NEUTRAL_BORDER };
  }
}
