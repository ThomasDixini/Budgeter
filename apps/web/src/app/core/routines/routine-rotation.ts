/** One stretch of the rotation: a routine followed for a number of weeks in a row. */
export interface RotationStep {
  readonly routineId: string;
  readonly weeks: number;
}

/**
 * Which routine is followed week by week, as a cycle that repeats: e.g. "Normal" for two weeks,
 * "Intense" for one, "Light" for one, then "Normal" again. Routines outside the rotation apply every
 * week; one inside it applies only in its own weeks. No steps means the rotation is off.
 */
export interface RoutineRotation {
  /** ISO day of the Monday the cycle's first week starts on. */
  readonly startsOn: string;
  readonly steps: readonly RotationStep[];
}

/** Where a day falls in the rotation's cycle, and the routine followed that week. */
export interface RotationWeek {
  /** 1-based week of the cycle. */
  readonly week: number;
  readonly cycleLength: number;
  readonly routineId: string;
}

/** Weeks a step covers in the cycle, both 1-based and inclusive. */
export interface StepWeeks {
  readonly from: number;
  readonly to: number;
}

export const MAX_ROTATION_STEPS = 12;
export const MAX_STEP_WEEKS = 12;

/** What the API answers before a rotation was saved (0001-01-01 is a Monday). */
export const NO_ROTATION: RoutineRotation = { startsOn: '0001-01-01', steps: [] };

const MS_PER_DAY = 86_400_000;
const DAYS_PER_WEEK = 7;
/** 1970-01-01, day 0, was a Thursday: index 3 when Monday is 0. */
const EPOCH_WEEKDAY = 3;

/**
 * The Monday that opens the week of an ISO day.
 * @example mondayOf('2026-11-05') // '2026-11-02'
 */
export function mondayOf(isoDay: string): string {
  const day = dayNumber(isoDay);
  const weekday = (((day + EPOCH_WEEKDAY) % DAYS_PER_WEEK) + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  return new Date((day - weekday) * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * How many weeks the cycle lasts before it starts over.
 * @example cycleLength({ startsOn, steps: [{ routineId: 'normal', weeks: 2 }, { routineId: 'light', weeks: 1 }] }) // 3
 */
export function cycleLength(rotation: RoutineRotation): number {
  return rotation.steps.reduce((sum, step) => sum + step.weeks, 0);
}

/**
 * The week of the cycle a day falls in. Days before the start count backwards through the cycle, so
 * every day has a routine. Undefined while the rotation is off.
 * @example rotationWeek(rotation, '2026-11-16')?.routineId // 'intense' (third week after 2026-11-02)
 */
export function rotationWeek(rotation: RoutineRotation, isoDay: string): RotationWeek | undefined {
  const length = cycleLength(rotation);
  if (length === 0) return undefined;
  const weeksSinceStart = Math.floor(
    (dayNumber(isoDay) - dayNumber(rotation.startsOn)) / DAYS_PER_WEEK,
  );
  const index = ((weeksSinceStart % length) + length) % length;
  return { week: index + 1, cycleLength: length, routineId: stepAtWeek(rotation, index).routineId };
}

/**
 * Weeks of the cycle each step covers, in step order.
 * @example stepWeeks(rotation) // [{ from: 1, to: 2 }, { from: 3, to: 3 }]
 */
export function stepWeeks(rotation: RoutineRotation): StepWeeks[] {
  let from = 1;
  return rotation.steps.map((step) => {
    const covered = { from, to: from + step.weeks - 1 };
    from += step.weeks;
    return covered;
  });
}

/**
 * Whether the rotation alternates this routine, so it applies only in its own weeks.
 * @example isRotating(rotation, 'normal') // true
 */
export function isRotating(rotation: RoutineRotation, routineId: string): boolean {
  return rotation.steps.some((step) => step.routineId === routineId);
}

/**
 * Share of the weeks a routine applies in: 1 outside the rotation, its weeks over the cycle inside it.
 * @example weekShare(rotation, 'normal') // 0.5 (two weeks of four)
 */
export function weekShare(rotation: RoutineRotation, routineId: string): number {
  if (!isRotating(rotation, routineId)) return 1;
  const weeks = rotation.steps
    .filter((step) => step.routineId === routineId)
    .reduce((sum, step) => sum + step.weeks, 0);
  return weeks / cycleLength(rotation);
}

function stepAtWeek(rotation: RoutineRotation, index: number): RotationStep {
  let remaining = index;
  for (const step of rotation.steps) {
    if (remaining < step.weeks) return step;
    remaining -= step.weeks;
  }
  return rotation.steps[rotation.steps.length - 1];
}

/** Days since 1970-01-01 for an ISO `YYYY-MM-DD` day, free of time zones and daylight saving. */
function dayNumber(isoDay: string): number {
  const [year, month, day] = isoDay.split('-').map(Number);
  const utc = new Date(0);
  // setUTCFullYear, unlike Date.UTC, keeps years below 100 as they are.
  utc.setUTCFullYear(year, month - 1, day);
  return Math.round(utc.getTime() / MS_PER_DAY);
}
