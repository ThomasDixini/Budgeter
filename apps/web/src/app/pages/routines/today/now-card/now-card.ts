import { Component, computed, input } from '@angular/core';
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

  protected readonly current = computed(() => {
    const routine = this.routine();
    const block = routine === undefined ? undefined : currentBlock(routine, this.nowMinutes());
    return block === undefined ? undefined : this.toView(block);
  });
  protected readonly nextBlock = computed(() =>
    sortBlocks(this.routine()?.blocks ?? []).find(
      (block) => toMinutes(block.start) > this.nowMinutes(),
    ),
  );

  private toView(block: RoutineBlock): CurrentBlockView {
    return {
      block,
      category: findCategory(this.categories(), block.categoryId),
      remaining: `${minutesLeft(block, this.nowMinutes())} min left`,
      elapsed: blockElapsed(block, this.nowMinutes()),
    };
  }
}
