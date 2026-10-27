import { Component, computed, inject, signal } from '@angular/core';
import { PageHeading } from '../../../components/page-heading/page-heading';
import { IdGenerator } from '../../../core/ids/id-generator';
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

type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

const SAVE_STATE_MESSAGES: Readonly<Record<SaveState, string>> = {
  idle: '',
  saving: 'Saving…',
  saved: 'All changes saved',
  failed: "Couldn't save. Check the block names and times, then try again.",
};

/** Lets the user pick a day template, its weekdays and hours, and split the day into blocks. */
@Component({
  selector: 'app-routine-editor',
  imports: [PageHeading, RoutinePartition, RoutineSummary],
  templateUrl: './routine-editor.html',
  styleUrl: './routine-editor.css',
})
export class RoutineEditor {
  private readonly store = inject(RoutinesStore);
  private readonly ids = inject(IdGenerator);
  /** Unsaved edits per routine id, so switching templates keeps them until "Save routine". */
  private readonly edits = signal<ReadonlyMap<string, Routine>>(new Map());
  private readonly selectedId = signal<string | undefined>(undefined);
  private readonly saveState = signal<SaveState>('idle');

  protected readonly weekdayLabels = WEEKDAY_LABELS;
  protected readonly categories = this.store.categories;
  protected readonly isLoaded = this.store.isLoaded;
  protected readonly routines = computed(() =>
    this.store.routines().map((routine) => this.edits().get(routine.id) ?? routine),
  );
  protected readonly draft = computed(
    () => this.routines().find((routine) => routine.id === this.selectedId()) ?? this.routines()[0],
  );
  protected readonly hasChanges = computed(() => this.edits().has(this.draft()?.id ?? ''));
  protected readonly isSaving = computed(() => this.saveState() === 'saving');
  protected readonly hasSaveFailed = computed(() => this.saveState() === 'failed');
  protected readonly saveMessage = computed(() =>
    this.hasChanges() && this.saveState() === 'idle'
      ? 'Unsaved changes'
      : SAVE_STATE_MESSAGES[this.saveState()],
  );
  protected readonly rows = computed(() =>
    (this.draft()?.blocks ?? []).map((block) => ({
      block,
      dotColor: findCategory(this.categories(), block.categoryId)?.color ?? UNCATEGORIZED_COLOR,
    })),
  );

  protected selectRoutine(routineId: string): void {
    this.selectedId.set(routineId);
    this.saveState.set('idle');
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
    this.edit((routine) => appendBlock(routine, this.ids.next()));
  }

  protected async save(): Promise<void> {
    const draft = this.draft();
    if (draft === undefined || !this.hasChanges()) return;
    this.saveState.set('saving');
    const isSaved = await this.store.saveRoutine(draft);
    if (!isSaved) {
      this.saveState.set('failed');
      return;
    }
    this.dropEditIfUnchanged(draft);
    this.saveState.set(this.hasChanges() ? 'idle' : 'saved');
  }

  protected valueOf(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  private edit(change: (routine: Routine) => Routine): void {
    const draft = this.draft();
    if (draft === undefined) return;
    const edited = change(draft);
    this.edits.update((edits) => new Map(edits).set(edited.id, edited));
    this.saveState.set('idle');
  }

  /** Edits made while the request was in flight stay as unsaved changes. */
  private dropEditIfUnchanged(saved: Routine): void {
    if (this.edits().get(saved.id) !== saved) return;
    this.edits.update((edits) => {
      const remaining = new Map(edits);
      remaining.delete(saved.id);
      return remaining;
    });
  }
}
