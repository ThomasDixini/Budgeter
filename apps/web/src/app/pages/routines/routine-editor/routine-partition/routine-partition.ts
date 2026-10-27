import { Component, computed, input } from '@angular/core';
import { Category, findCategory, withAlpha } from '../../../../core/routines/category';
import { Routine, hourTicks, scheduleIssues } from '../../../../core/routines/routine';
import { partitionSegments } from '../../../../core/routines/routine-edits';

interface SegmentView {
  readonly id: string;
  readonly name: string;
  readonly caption: string;
  readonly left: number;
  readonly width: number;
  readonly background: string;
  readonly border: string;
  readonly captionColor: string;
}

/** Horizontal bar showing how the routine day is split, with hour ticks and schedule warnings. */
@Component({
  selector: 'app-routine-partition',
  templateUrl: './routine-partition.html',
  styleUrl: './routine-partition.css',
})
export class RoutinePartition {
  readonly routine = input.required<Routine>();
  readonly categories = input.required<readonly Category[]>();

  protected readonly ticks = computed(() => hourTicks(this.routine()));
  protected readonly issues = computed(() => scheduleIssues(this.routine().blocks).join(' · '));
  protected readonly segments = computed(() =>
    partitionSegments(this.routine()).map(({ block, left, width }): SegmentView => {
      const category = findCategory(this.categories(), block.categoryId);
      const range = `${block.start}–${block.end}`;
      return {
        id: block.id,
        name: block.name,
        caption: category ? `${category.name} · ${range}` : range,
        left,
        width,
        background: category ? withAlpha(category.color, 0.14) : 'rgba(255, 255, 255, 0.06)',
        border: category ? withAlpha(category.color, 0.4) : 'rgba(255, 255, 255, 0.14)',
        captionColor: category?.color ?? 'var(--color-text-muted)',
      };
    }),
  );
}
