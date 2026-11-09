import {
  MAX_ROTATION_STEPS,
  MAX_STEP_WEEKS,
  RotationStep,
  RoutineRotation,
  mondayOf,
} from './routine-rotation';

/**
 * The rotation with one more week of a routine at the end. The first step starts the cycle on the
 * Monday of `today`'s week, so a new plan begins now.
 * @example withAddedStep(NO_ROTATION, 'normal', '2026-11-05') // { startsOn: '2026-11-02', steps: [{ routineId: 'normal', weeks: 1 }] }
 */
export function withAddedStep(
  rotation: RoutineRotation,
  routineId: string,
  today: string,
): RoutineRotation {
  if (rotation.steps.length >= MAX_ROTATION_STEPS) return rotation;
  const startsOn = rotation.steps.length === 0 ? mondayOf(today) : rotation.startsOn;
  return { startsOn, steps: [...rotation.steps, { routineId, weeks: 1 }] };
}

/** @example withStepRoutine(rotation, 1, 'intense') */
export function withStepRoutine(
  rotation: RoutineRotation,
  index: number,
  routineId: string,
): RoutineRotation {
  return withStep(rotation, index, (step) => ({ ...step, routineId }));
}

/**
 * The step lasting `weeks`, kept within 1 and the most a step may last.
 * @example withStepWeeks(rotation, 0, 2)
 */
export function withStepWeeks(
  rotation: RoutineRotation,
  index: number,
  weeks: number,
): RoutineRotation {
  const valid = Math.min(MAX_STEP_WEEKS, Math.max(1, Math.round(weeks)));
  return withStep(rotation, index, (step) => ({ ...step, weeks: valid }));
}

/** @example withoutStep(rotation, 2) */
export function withoutStep(rotation: RoutineRotation, index: number): RoutineRotation {
  return { ...rotation, steps: rotation.steps.filter((_, position) => position !== index) };
}

/**
 * The cycle starting on the Monday of the week `isoDay` is in.
 * @example withStart(rotation, '2026-11-18').startsOn // '2026-11-16'
 */
export function withStart(rotation: RoutineRotation, isoDay: string): RoutineRotation {
  return { ...rotation, startsOn: mondayOf(isoDay) };
}

/**
 * The rotation without a deleted routine's steps, as the API leaves it.
 * @example withoutRoutine(rotation, 'light')
 */
export function withoutRoutine(rotation: RoutineRotation, routineId: string): RoutineRotation {
  return { ...rotation, steps: rotation.steps.filter((step) => step.routineId !== routineId) };
}

/**
 * Whether two rotations plan the same weeks, so there is nothing to save.
 * @example sameRotation(draft, saved) // false after an edit
 */
export function sameRotation(first: RoutineRotation, second: RoutineRotation): boolean {
  if (first.steps.length !== second.steps.length) return false;
  if (first.steps.length > 0 && first.startsOn !== second.startsOn) return false;
  return first.steps.every(
    (step, index) =>
      step.routineId === second.steps[index].routineId && step.weeks === second.steps[index].weeks,
  );
}

function withStep(
  rotation: RoutineRotation,
  index: number,
  change: (step: RotationStep) => RotationStep,
): RoutineRotation {
  const steps = rotation.steps.map((step, position) => (position === index ? change(step) : step));
  return { ...rotation, steps };
}
