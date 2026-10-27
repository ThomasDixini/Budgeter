import { Component, computed, input, output } from '@angular/core';
import { BlockOutcomeKind } from '../../../../core/routines/day-plan';
import { toMinutes } from '../../../../core/calendar/time-of-day';
import { Category, findCategory } from '../../../../core/routines/category';
import { blockElapsed, currentBlock, minutesLeft } from '../../../../core/routines/day-timeline';
import { Routine, RoutineBlock, sortBlocks } from '../../../../core/routines/routine';

interface CurrentBlockView {
  readonly block: RoutineBlock;
  readonly category?: Category;
  readonly remaining: string;
  readonly elapsed: number;
}

/** Highlights the routine block happening now, or what comes next when the day is between blocks. */
@Component({
  selector: 'app-now-card',
  templateUrl: './now-card.html',
  styleUrl: './now-card.css',
})
export class NowCard {
  readonly routine = input.required<Routine | undefined>();
  readonly categories = input.required<readonly Category[]>();
  readonly nowMinutes = input.required<number>();
  /** How today's blocks ended so far, by block id; ended blocks are never "now" again. */
  readonly outcomes = input<ReadonlyMap<string, BlockOutcomeKind>>(new Map());
  /** Emits the id of the running block when it is completed. */
  readonly complete = output<string>();
  /** Emits the id of the running block when it is skipped. */
  readonly skip = output<string>();

  protected readonly current = computed(() => {
    const block = currentBlock(this.pendingRoutine(), this.nowMinutes());
    return block === undefined ? undefined : this.toView(block);
  });
  protected readonly nextBlock = computed(() =>
    sortBlocks(this.pendingRoutine().blocks).find(
      (block) => toMinutes(block.start) > this.nowMinutes(),
    ),
  );

  /** The routine without the blocks that already ended today. */
  private readonly pendingRoutine = computed((): Pick<Routine, 'blocks'> => {
    const blocks = this.routine()?.blocks ?? [];
    return { blocks: blocks.filter((block) => !this.outcomes().has(block.id)) };
  });

  private toView(block: RoutineBlock): CurrentBlockView {
    return {
      block,
      category: findCategory(this.categories(), block.categoryId),
      remaining: `${minutesLeft(block, this.nowMinutes())} min left`,
      elapsed: blockElapsed(block, this.nowMinutes()),
    };
  }
}
