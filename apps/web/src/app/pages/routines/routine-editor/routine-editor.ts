import { Component, computed, inject, signal } from '@angular/core';
import { fieldValue } from '../../../core/forms/field-value';
import { LoadFailed } from '../../../components/load-failed/load-failed';
import { PageHeading } from '../../../components/page-heading/page-heading';
import { IdGenerator } from '../../../core/ids/id-generator';
import { findCategory } from '../../../core/routines/category';
import { Routine, WEEKDAY_LABELS, weekdaysLabel } from '../../../core/routines/routine';
import { RoutineRotationStore } from '../../../core/routines/routine-rotation-store';
import { dayClashes } from '../../../core/routines/routine-schedule';
import {
  BlockChanges,
  appendBlock,
  newRoutine,
  removeBlock,
  toggleDay,
  updateBlock,
} from '../../../core/routines/routine-edits';
import { RoutinesStore } from '../../../core/routines/routines-store';
import { RoutinePartition } from './routine-partition/routine-partition';
import { RoutineSummary } from './routine-summary/routine-summary';
import { RotationPlan } from './rotation-plan/rotation-plan';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

const UNCATEGORIZED_COLOR = '#8A8A94';

type SaveState = 'idle' | 'saving' | 'saved' | 'failed' | 'delete-failed';

const SAVE_STATE_MESSAGES: Readonly<Record<SaveState, string>> = {
  idle: '',
  saving: 'Saving…',
  saved: 'All changes saved',
  // The notice at the bottom of the screen gives the reason, e.g. a block category that is gone.
  failed: "Couldn't save the routine. Fix what the message below says, then try again.",
  'delete-failed': "Couldn't delete the routine. Try again.",
};

const CLASH_LOST =
  '"{name}" also runs on {days} and is the one used on those days. To alternate them by week, add both to the rotation plan.';
const CLASH_WON =
  '"{name}" also runs on {days}; this routine is the one used on those days. To alternate them by week, add both to the rotation plan.';

/** Lets the user pick a day template, its weekdays and hours, and split the day into blocks. */
@Component({
  selector: 'app-routine-editor',
  imports: [TranslatePipe, PageHeading, RoutinePartition, RoutineSummary, RotationPlan, LoadFailed],
  templateUrl: './routine-editor.html',
  styleUrl: './routine-editor.css',
})
export class RoutineEditor {
  private readonly store = inject(RoutinesStore);
  private readonly rotationStore = inject(RoutineRotationStore);
  private readonly ids = inject(IdGenerator);
  /** Unsaved edits per routine id, so switching templates keeps them until "Save routine". */
  private readonly edits = signal<ReadonlyMap<string, Routine>>(new Map());
  private readonly selectedId = signal<string | undefined>(undefined);
  private readonly saveState = signal<SaveState>('idle');

  protected readonly weekdayLabels = WEEKDAY_LABELS;
  protected readonly categories = this.store.categories;
  protected readonly isLoaded = this.store.isLoaded;
  protected readonly hasLoadFailed = this.store.hasLoadFailed;
  /** Stored routines with their unsaved edits, then routines created here and not saved yet. */
  protected readonly routines = computed(() => {
    const stored = this.store.routines();
    const storedIds = new Set(stored.map((routine) => routine.id));
    const created = [...this.edits().values()].filter((routine) => !storedIds.has(routine.id));
    return [...stored.map((routine) => this.edits().get(routine.id) ?? routine), ...created];
  });
  protected readonly draft = computed(
    () => this.routines().find((routine) => routine.id === this.selectedId()) ?? this.routines()[0],
  );
  protected readonly hasChanges = computed(() => this.edits().has(this.draft()?.id ?? ''));
  protected readonly isSaving = computed(() => this.saveState() === 'saving');
  protected readonly hasSaveFailed = computed(() => this.saveState().endsWith('failed'));
  /** Deleting asks first, since a routine and its blocks cannot be brought back. */
  protected readonly isConfirmingDelete = signal(false);
  protected readonly saveMessage = computed(() =>
    this.hasChanges() && this.saveState() === 'idle'
      ? 'Unsaved changes'
      : SAVE_STATE_MESSAGES[this.saveState()],
  );
  /** Other routines that claim some of the draft's weekdays in the same weeks. */
  protected readonly clashes = computed(() => {
    const draft = this.draft();
    if (draft === undefined) return [];
    return dayClashes(this.routines(), this.rotationStore.rotation(), draft).map((clash) => ({
      name: clash.routine.name,
      days: weekdaysLabel(clash.days),
      message: clash.winsTheDays ? CLASH_LOST : CLASH_WON,
    }));
  });
  protected readonly rows = computed(() =>
    (this.draft()?.blocks ?? []).map((block) => ({
      block,
      dotColor: findCategory(this.categories(), block.categoryId)?.color ?? UNCATEGORIZED_COLOR,
    })),
  );

  protected reload(): void {
    this.store.reload();
  }

  protected selectRoutine(routineId: string | undefined): void {
    this.selectedId.set(routineId);
    this.saveState.set('idle');
    this.isConfirmingDelete.set(false);
  }

  /**
   * Deletes the selected routine after the user confirmed. A routine created here and never
   * saved only exists as a draft, so dropping the draft is enough.
   */
  protected async deleteRoutine(): Promise<void> {
    const draft = this.draft();
    if (draft === undefined) return;
    this.isConfirmingDelete.set(false);
    const isStored = this.store.routines().some((routine) => routine.id === draft.id);
    if (isStored && !(await this.store.deleteRoutine(draft.id))) {
      this.saveState.set('delete-failed');
      return;
    }
    this.rotationStore.forgetRoutine(draft.id);
    this.dropEdit(draft.id);
    this.selectRoutine(undefined);
  }

  /** Opens a blank routine as an unsaved draft; it is stored on "Save routine". */
  protected createRoutine(): void {
    const routine = newRoutine(this.ids.next());
    this.edits.update((edits) => new Map(edits).set(routine.id, routine));
    this.selectRoutine(routine.id);
  }

  protected rename(name: string): void {
    this.edit((routine) => ({ ...routine, name }));
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

  protected readonly valueOf = fieldValue;

  private edit(change: (routine: Routine) => Routine): void {
    const draft = this.draft();
    if (draft === undefined) return;
    const edited = change(draft);
    this.edits.update((edits) => new Map(edits).set(edited.id, edited));
    this.saveState.set('idle');
  }

  /** Edits made while the request was in flight stay as unsaved changes. */
  private dropEditIfUnchanged(saved: Routine): void {
    if (this.edits().get(saved.id) === saved) this.dropEdit(saved.id);
  }

  private dropEdit(routineId: string): void {
    this.edits.update((edits) => {
      const remaining = new Map(edits);
      remaining.delete(routineId);
      return remaining;
    });
  }
}
