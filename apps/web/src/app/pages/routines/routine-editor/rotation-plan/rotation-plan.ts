import { Component, computed, inject, signal } from '@angular/core';
import { Clock } from '../../../../core/calendar/clock';
import { isoDate } from '../../../../core/calendar/date-label';
import { fieldValue } from '../../../../core/forms/field-value';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import {
  MAX_ROTATION_STEPS,
  MAX_STEP_WEEKS,
  RoutineRotation,
  StepWeeks,
  rotationWeek,
  stepWeeks,
} from '../../../../core/routines/routine-rotation';
import { RoutineRotationStore } from '../../../../core/routines/routine-rotation-store';
import { RoutinesStore } from '../../../../core/routines/routines-store';
import {
  sameRotation,
  withAddedStep,
  withStart,
  withStepRoutine,
  withStepWeeks,
  withoutStep,
} from '../../../../core/routines/rotation-edits';

type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

const SAVE_STATE_MESSAGES: Readonly<Record<SaveState, string>> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Rotation saved',
  failed: "Couldn't save the rotation. Fix what the message below says, then try again.",
};

/**
 * Plans which routine is followed week by week (e.g. two weeks of "Normal", one of "Intense", one of
 * "Light"), as a cycle that starts over after its last step. Edits stay here until "Save plan".
 */
@Component({
  selector: 'app-rotation-plan',
  imports: [TranslatePipe],
  templateUrl: './rotation-plan.html',
  styleUrl: './rotation-plan.css',
})
export class RotationPlan {
  private readonly routinesStore = inject(RoutinesStore);
  private readonly rotationStore = inject(RoutineRotationStore);
  private readonly clock = inject(Clock);
  /** The unsaved plan, if anything was changed since the last save. */
  private readonly edited = signal<RoutineRotation | undefined>(undefined);
  private readonly saveState = signal<SaveState>('idle');

  protected readonly maxWeeks = MAX_STEP_WEEKS;
  /** Only stored routines can be planned: the API rejects a rotation of an unsaved one. */
  protected readonly routines = this.routinesStore.routines;
  protected readonly draft = computed(() => this.edited() ?? this.rotationStore.rotation());
  protected readonly hasChanges = computed(
    () => !sameRotation(this.draft(), this.rotationStore.rotation()),
  );
  protected readonly isSaving = computed(() => this.saveState() === 'saving');
  protected readonly hasSaveFailed = computed(() => this.saveState() === 'failed');
  protected readonly canAddStep = computed(
    () => this.routines().length > 0 && this.draft().steps.length < MAX_ROTATION_STEPS,
  );
  protected readonly saveMessage = computed(() =>
    this.hasChanges() && this.saveState() === 'idle'
      ? 'Unsaved changes'
      : SAVE_STATE_MESSAGES[this.saveState()],
  );
  protected readonly rows = computed(() => {
    const weeks = stepWeeks(this.draft());
    return this.draft().steps.map((step, index) => ({
      index,
      step,
      weeksLabel: weeksLabel(weeks[index]),
    }));
  });
  /** Where this week falls in the plan on screen, and the routine it follows. */
  protected readonly thisWeek = computed(() => {
    const week = rotationWeek(this.draft(), this.today());
    const routine = this.routines().find((candidate) => candidate.id === week?.routineId);
    return week && routine ? { ...week, name: routine.name } : undefined;
  });

  protected readonly valueOf = fieldValue;

  protected addStep(): void {
    const firstRoutine = this.routines()[0];
    if (firstRoutine === undefined) return;
    this.edit((rotation) => withAddedStep(rotation, firstRoutine.id, this.today()));
  }

  protected setRoutine(index: number, routineId: string): void {
    this.edit((rotation) => withStepRoutine(rotation, index, routineId));
  }

  /** A cleared or non-numeric field keeps the previous length, so the plan never goes invalid. */
  protected setWeeks(index: number, value: string): void {
    const weeks = Number(value);
    if (value === '' || !Number.isFinite(weeks)) return;
    this.edit((rotation) => withStepWeeks(rotation, index, weeks));
  }

  protected removeStep(index: number): void {
    this.edit((rotation) => withoutStep(rotation, index));
  }

  /** A cleared date field keeps the previous start. */
  protected setStart(isoDay: string): void {
    if (isoDay === '') return;
    this.edit((rotation) => withStart(rotation, isoDay));
  }

  protected async save(): Promise<void> {
    const draft = this.draft();
    if (!this.hasChanges()) return;
    this.saveState.set('saving');
    const isSaved = await this.rotationStore.save(draft);
    if (!isSaved) {
      this.saveState.set('failed');
      return;
    }
    // Edits made while the request was in flight stay as unsaved changes.
    if (this.edited() === draft) this.edited.set(undefined);
    this.saveState.set(this.hasChanges() ? 'idle' : 'saved');
  }

  private edit(change: (rotation: RoutineRotation) => RoutineRotation): void {
    this.edited.set(change(this.draft()));
    this.saveState.set('idle');
  }

  private today(): string {
    return isoDate(this.clock.now());
  }
}

/**
 * The weeks of the cycle a step covers, as shown next to it.
 * @example weeksLabel({ from: 1, to: 2 }) // 'Weeks 1–2'
 */
function weeksLabel(weeks: StepWeeks): string {
  return weeks.from === weeks.to ? `Week ${weeks.from}` : `Weeks ${weeks.from}–${weeks.to}`;
}
