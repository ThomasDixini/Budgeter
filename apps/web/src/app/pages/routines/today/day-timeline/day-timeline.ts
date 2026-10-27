import { Component, computed, input } from '@angular/core';
import { formatClock } from '../../../../core/calendar/time-of-day';
import { Category, findCategory, withAlpha } from '../../../../core/routines/category';
import { BlockOutcomeKind } from '../../../../core/routines/day-plan';
import {
  isCompactBlock,
  nowLineOffset,
  timelineBlocks,
  timelineHeight,
  timelineHours,
} from '../../../../core/routines/day-timeline';
import { Routine } from '../../../../core/routines/routine';

interface TimelineBlockView {
  readonly key: string;
  readonly name: string;
  readonly range: string;
  /** Name, time and category in one line, for the tooltip of blocks too short to show them all. */
  readonly summary: string;
  readonly top: number;
  readonly height: number;
  readonly left: number;
  readonly width: number;
  readonly isNow: boolean;
  /** Set once the block was completed or skipped today. */
  readonly outcome?: BlockOutcomeKind;
  /** Drawn on a single line because the block is short. */
  readonly isCompact: boolean;
  readonly category?: Category;
  readonly background: string;
  readonly border: string;
}

const OUTCOME_LABELS: Readonly<Record<BlockOutcomeKind, string>> = {
  done: 'Done',
  skipped: 'Skipped',
};

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
  /** How today's blocks ended so far, by block id. */
  readonly outcomes = input<ReadonlyMap<string, BlockOutcomeKind>>(new Map());

  protected readonly height = computed(() => timelineHeight(this.routine()));
  protected readonly hours = computed(() => timelineHours(this.routine()));
  protected readonly nowOffset = computed(() => nowLineOffset(this.routine(), this.nowMinutes()));
  protected readonly nowLabel = computed(() => formatClock(this.nowMinutes()));
  protected readonly outcomeLabels = OUTCOME_LABELS;
  protected readonly blocks = computed(() =>
    timelineBlocks(this.routine(), this.nowMinutes()).map(({ block, isNow, ...placement }) => {
      const category = findCategory(this.categories(), block.categoryId);
      const range = `${block.start} – ${block.end}`;
      const outcome = this.outcomes().get(block.id);
      return {
        name: block.name,
        range,
        summary: [block.name, range, category?.name, outcome && OUTCOME_LABELS[outcome]]
          .filter(Boolean)
          .join(' · '),
        ...placement,
        isNow: isNow && outcome === undefined,
        outcome,
        isCompact: isCompactBlock(placement.height),
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
