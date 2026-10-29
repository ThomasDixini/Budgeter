import { Component, computed, input, output } from '@angular/core';
import { formatClock } from '../../../../core/calendar/time-of-day';
import { Category, findCategory, withAlpha } from '../../../../core/routines/category';
import { BlockOutcomeKind } from '../../../../core/routines/day-plan';
import {
  TimelineBlock,
  isCompactBlock,
  nowLineOffset,
  timelineBlocks,
  timelineHeight,
  timelineHours,
} from '../../../../core/routines/day-timeline';
import { Routine } from '../../../../core/routines/routine';

interface TimelineBlockView {
  readonly key: string;
  readonly blockId: string;
  readonly name: string;
  readonly range: string;
  /** Name, time and category in one line, for the tooltip of blocks too short to show them all. */
  readonly summary: string;
  readonly top: number;
  readonly height: number;
  readonly isNow: boolean;
  readonly isSelected: boolean;
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
const DONE_BACKGROUND = 'rgba(46, 242, 166, 0.08)';
const DONE_BORDER = 'rgba(46, 242, 166, 0.35)';

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
  /** Planned length in minutes of each ended block, used when the day is not running. */
  readonly plannedLengths = input<ReadonlyMap<string, number>>(new Map());
  /** Emits the id of an ended block the user wants back as it was planned. */
  readonly undo = output<string>();
  /** The block picked to filter the day's tasks, if any. */
  readonly selectedBlockId = input<string | undefined>(undefined);
  /** Emits the id of the block the user clicked to filter tasks by. */
  readonly pick = output<string>();
  /** Emits the id of a pending block the user marks as done. */
  readonly complete = output<string>();
  /** Emits the id of a pending block the user skips. */
  readonly skip = output<string>();

  /** Ended blocks with their planned length, falling back to how long they lasted. */
  private readonly endedBlocks = computed(
    () =>
      new Map(
        [...this.outcomes().keys()].map((blockId) => [
          blockId,
          this.plannedLengths().get(blockId) ?? 0,
        ]),
      ),
  );

  protected readonly height = computed(() => timelineHeight(this.routine()));
  protected readonly hours = computed(() => timelineHours(this.routine()));
  protected readonly nowOffset = computed(() => nowLineOffset(this.routine(), this.nowMinutes()));
  protected readonly nowLabel = computed(() => formatClock(this.nowMinutes()));
  protected readonly outcomeLabels = OUTCOME_LABELS;
  protected readonly blocks = computed(() =>
    timelineBlocks(this.routine(), this.nowMinutes(), this.endedBlocks()).map((entry) =>
      this.toView(entry),
    ),
  );

  private toView({ block, isNow, ...placement }: TimelineBlock): TimelineBlockView {
    const category = findCategory(this.categories(), block.categoryId);
    const range = `${block.start} – ${block.end}`;
    const outcome = this.outcomes().get(block.id);
    const isRunning = isNow && outcome === undefined;
    return {
      ...placement,
      blockId: block.id,
      name: block.name,
      range,
      summary: [block.name, range, category?.name, outcome && OUTCOME_LABELS[outcome]]
        .filter(Boolean)
        .join(' · '),
      isNow: isRunning,
      isSelected: block.id === this.selectedBlockId(),
      outcome,
      isCompact: isCompactBlock(placement.height),
      category,
      ...blockColors(category, isRunning, outcome),
    };
  }
}

/** Done blocks turn mint, skipped ones go neutral, so the two read apart at a glance. */
function blockColors(
  category: Category | undefined,
  isNow: boolean,
  outcome: BlockOutcomeKind | undefined,
): Pick<TimelineBlockView, 'background' | 'border'> {
  if (outcome === 'done') return { background: DONE_BACKGROUND, border: DONE_BORDER };
  if (outcome === 'skipped') return { background: NEUTRAL_BACKGROUND, border: NEUTRAL_BORDER };
  const background = category ? withAlpha(category.color, 0.07) : NEUTRAL_BACKGROUND;
  if (isNow) return { background, border: NOW_BORDER };
  return { background, border: category ? withAlpha(category.color, 0.28) : NEUTRAL_BORDER };
}
