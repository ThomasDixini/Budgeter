import { Component, computed, inject, signal } from '@angular/core';
import { PageHeading } from '../../../components/page-heading/page-heading';
import { findCategory } from '../../../core/routines/category';
import { Routine, WEEKDAY_LABELS } from '../../../core/routines/routine';
import {
  BlockChanges,
  appendBlock,
  removeBlock,
  toggleDay,
  updateBlock,
} from '../../../core/routines/routine-edits';
import { RoutinesStore } from '../../../core/routines/routines-store';
import { RoutinePartition } from './routine-partition/routine-partition';
import { RoutineSummary } from './routine-summary/routine-summary';

const UNCATEGORIZED_COLOR = '#8A8A94';

/** Lets the user pick a day template, its weekdays and hours, and split the day into blocks. */
@Component({
  selector: 'app-routine-editor',
  imports: [PageHeading, RoutinePartition, RoutineSummary],
  templateUrl: './routine-editor.html',
  styleUrl: './routine-editor.css',
})
export class RoutineEditor {
  private readonly store = inject(RoutinesStore);
  private nextBlockNumber = 1;
  /** Unsaved edits per routine, so switching templates keeps them until "Save routine". */
  private readonly drafts = signal<readonly Routine[]>(this.store.routines());

  protected readonly weekdayLabels = WEEKDAY_LABELS;
  protected readonly categories = this.store.categories;
  protected readonly routines = this.drafts.asReadonly();
  protected readonly selectedId = signal(this.store.routines()[0]?.id ?? '');
  protected readonly draft = computed(
    () => this.drafts().find((routine) => routine.id === this.selectedId()) ?? this.drafts()[0],
  );
  protected readonly rows = computed(() =>
    this.draft().blocks.map((block) => ({
      block,
      dotColor: findCategory(this.categories(), block.categoryId)?.color ?? UNCATEGORIZED_COLOR,
    })),
  );

  protected selectRoutine(routineId: string): void {
    this.selectedId.set(routineId);
  }

  protected toggleWeekday(day: number): void {
    this.edit((routine) => toggleDay(routine, day));
  }

  /** A cleared time field reports an empty value; keeping the previous time avoids an invalid routine. */
  protected setHour(edge: 'start' | 'end', clock: string): void {
    if (clock === '') return;
    this.edit((routine) => ({ ...routine, [edge]: clock }));
  }

  protected changeBlockTime(blockId: string, edge: 'start' | 'end', clock: string): void {
    if (clock === '') return;
    this.changeBlock(blockId, { [edge]: clock });
  }

  protected changeBlock(blockId: string, changes: BlockChanges): void {
    this.edit((routine) => updateBlock(routine, blockId, changes));
  }

  protected changeBlockCategory(blockId: string, categoryId: string): void {
    this.changeBlock(blockId, { categoryId: categoryId === '' ? undefined : categoryId });
  }

  protected deleteBlock(blockId: string): void {
    this.edit((routine) => removeBlock(routine, blockId));
  }

  protected addBlock(): void {
    this.edit((routine) => appendBlock(routine, `new-block-${this.nextBlockNumber++}`));
  }

  protected save(): void {
    this.store.saveRoutine(this.draft());
  }

  protected valueOf(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  private edit(change: (routine: Routine) => Routine): void {
    const edited = change(this.draft());
    this.drafts.update((routines) =>
      routines.map((routine) => (routine.id === edited.id ? edited : routine)),
    );
  }
}
