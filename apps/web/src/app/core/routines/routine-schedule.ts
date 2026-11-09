import { isoDate } from '../calendar/date-label';
import { minutesOfDay, toMinutes, weekdayIndex } from '../calendar/time-of-day';
import { Routine } from './routine';
import { RoutineRotation, isRotating, rotationWeek } from './routine-rotation';

/** The routine running at a moment, and whether it began the evening before. */
export interface ActiveRoutine {
  readonly routine: Routine;
  readonly startedYesterday: boolean;
}

/** Another routine that claims some of a routine's weekdays in the same weeks. */
export interface DayClash {
  readonly routine: Routine;
  readonly days: readonly number[];
  /** Whether the other routine is the one that applies on those days. */
  readonly winsTheDays: boolean;
}

/**
 * The routines that apply in the week of a day, in the order they win a weekday: the routine the
 * rotation follows that week first, then the routines outside the rotation in creation order.
 * Routines the rotation follows in other weeks are left out.
 * @example routinesInEffect(routines, rotation, '2026-11-16').map((r) => r.name) // ['Intense', 'Weekend']
 */
export function routinesInEffect(
  routines: readonly Routine[],
  rotation: RoutineRotation,
  isoDay: string,
): Routine[] {
  const followedId = rotationWeek(rotation, isoDay)?.routineId;
  const followed = routines.filter((routine) => routine.id === followedId);
  return [...followed, ...routines.filter((routine) => !isRotating(rotation, routine.id))];
}

/**
 * The routine that applies on a day, if any.
 * @example routineForDay(routines, rotation, new Date(2026, 10, 14))?.name // 'Weekend'
 */
export function routineForDay(
  routines: readonly Routine[],
  rotation: RoutineRotation,
  day: Date,
): Routine | undefined {
  const weekday = weekdayIndex(day);
  return routinesInEffect(routines, rotation, isoDate(day)).find((routine) =>
    routine.days.includes(weekday),
  );
}

/**
 * The routine running at a moment. Before the end of a routine that began yesterday and runs past
 * midnight (a night shift), that one is still running; otherwise it is the one of today. Yesterday
 * may be in another week of the rotation (Sunday night into Monday), so each day is read on its own.
 * @example activeRoutine(routines, NO_ROTATION, new Date(2026, 9, 27, 2))?.routine.name // 'Night shift'
 */
export function activeRoutine(
  routines: readonly Routine[],
  rotation: RoutineRotation,
  moment: Date,
): ActiveRoutine | undefined {
  const yesterday = new Date(moment.getFullYear(), moment.getMonth(), moment.getDate() - 1);
  const carriedOver = routineForDay(routines, rotation, yesterday);
  if (carriedOver !== undefined && runsPastMidnight(carriedOver, minutesOfDay(moment))) {
    return { routine: carriedOver, startedYesterday: true };
  }
  const today = routineForDay(routines, rotation, moment);
  return today === undefined ? undefined : { routine: today, startedYesterday: false };
}

/**
 * Other routines sharing weekdays with `routine` in some week, so only one of them applies on those
 * days. Two routines of the rotation never clash: each has its own weeks. `routines` is in creation
 * order, which decides who wins between two routines outside the rotation.
 * @example dayClashes([normal, intense], NO_ROTATION, intense)[0].routine.name // 'Normal'
 */
export function dayClashes(
  routines: readonly Routine[],
  rotation: RoutineRotation,
  routine: Routine,
): DayClash[] {
  return routines
    .filter((other) => other.id !== routine.id)
    .filter((other) => !(isRotating(rotation, other.id) && isRotating(rotation, routine.id)))
    .map((other) => ({
      routine: other,
      days: routine.days.filter((day) => other.days.includes(day)),
      winsTheDays: winsOver(routines, rotation, other, routine),
    }))
    .filter((clash) => clash.days.length > 0);
}

/** The rotation's routine wins its weeks; between two outside it, the one created first wins. */
function winsOver(
  routines: readonly Routine[],
  rotation: RoutineRotation,
  other: Routine,
  routine: Routine,
): boolean {
  if (isRotating(rotation, other.id)) return true;
  if (isRotating(rotation, routine.id)) return false;
  const position = routines.findIndex((candidate) => candidate.id === routine.id);
  return position < 0 || routines.indexOf(other) < position;
}

function runsPastMidnight(routine: Routine, nowMinutes: number): boolean {
  const end = toMinutes(routine.end);
  return end <= toMinutes(routine.start) && nowMinutes < end;
}
