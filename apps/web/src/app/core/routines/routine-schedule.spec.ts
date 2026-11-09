import { Routine } from './routine';
import { NO_ROTATION, RoutineRotation } from './routine-rotation';
import { activeRoutine, dayClashes, routineForDay, routinesInEffect } from './routine-schedule';
import { SAMPLE_ROUTINES } from './sample-routines';

const [WEEKDAYS, WEEKEND] = SAMPLE_ROUTINES;
const NORMAL: Routine = { ...WEEKDAYS, id: 'normal', name: 'Normal' };
const INTENSE: Routine = { ...WEEKDAYS, id: 'intense', name: 'Intense', start: '07:00' };
const LIGHT: Routine = { ...WEEKDAYS, id: 'light', name: 'Light', end: '15:00' };
const ROUTINES = [NORMAL, INTENSE, LIGHT, WEEKEND];
/** Two weeks of Normal, one of Intense, one of Light, from Monday, November 2, 2026. */
const STUDY_PLAN: RoutineRotation = {
  startsOn: '2026-11-02',
  steps: [
    { routineId: 'normal', weeks: 2 },
    { routineId: 'intense', weeks: 1 },
    { routineId: 'light', weeks: 1 },
  ],
};

describe('routinesInEffect', () => {
  it("puts the week's routine of the rotation first, then the routines outside it", () => {
    expect(routinesInEffect(ROUTINES, STUDY_PLAN, '2026-11-18')).toEqual([INTENSE, WEEKEND]);
  });

  it('keeps every routine in creation order while the rotation is off', () => {
    expect(routinesInEffect(ROUTINES, NO_ROTATION, '2026-11-18')).toEqual(ROUTINES);
  });
});

describe('routineForDay', () => {
  it.each([
    [new Date(2026, 10, 4), 'Normal'],
    [new Date(2026, 10, 18), 'Intense'],
    [new Date(2026, 10, 25), 'Light'],
    [new Date(2026, 11, 2), 'Normal'],
    [new Date(2026, 10, 21), 'Weekend'],
  ])('follows the rotation on %s: %s', (day, name) => {
    expect(routineForDay(ROUTINES, STUDY_PLAN, day)?.name).toBe(name);
  });

  it('is the first routine created for the weekday when two share it outside the rotation', () => {
    expect(routineForDay([INTENSE, NORMAL], NO_ROTATION, new Date(2026, 10, 4))).toBe(INTENSE);
  });
});

describe('activeRoutine', () => {
  const NIGHT_SHIFT: Routine = {
    id: 'night',
    name: 'Night shift',
    days: [0],
    start: '22:00',
    end: '06:00',
    blocks: [],
  };
  const DAYTIME: Routine = { ...WEEKDAYS, days: [1, 2, 3, 4] };
  /** Tuesday, October 27, 2026, at a given hour. */
  const tuesdayAt = (hour: number): Date => new Date(2026, 9, 27, hour);

  it('is the routine of the day during the day', () => {
    const active = activeRoutine([DAYTIME, NIGHT_SHIFT], NO_ROTATION, tuesdayAt(14));

    expect(active).toEqual({ routine: DAYTIME, startedYesterday: false });
  });

  it("keeps last night's routine running until it ends", () => {
    const active = activeRoutine([DAYTIME, NIGHT_SHIFT], NO_ROTATION, tuesdayAt(2));

    expect(active).toEqual({ routine: NIGHT_SHIFT, startedYesterday: true });
  });

  it("goes back to the day's routine once last night's has ended", () => {
    expect(activeRoutine([DAYTIME, NIGHT_SHIFT], NO_ROTATION, tuesdayAt(6))?.routine).toBe(DAYTIME);
  });

  it("ignores yesterday's routine when it ended before midnight", () => {
    expect(activeRoutine([DAYTIME], NO_ROTATION, tuesdayAt(1))).toEqual({
      routine: DAYTIME,
      startedYesterday: false,
    });
  });

  it('is nothing when no routine covers the day', () => {
    expect(activeRoutine([DAYTIME], NO_ROTATION, new Date(2026, 9, 31, 10))).toBeUndefined();
  });

  it("carries Sunday night's routine into Monday although Monday starts another week", () => {
    const sundayNight: Routine = { ...NIGHT_SHIFT, id: 'late', days: [6] };
    const early: Routine = { ...WEEKDAYS, id: 'early', days: [0, 1, 2, 3, 4, 5, 6] };
    const rotation: RoutineRotation = {
      startsOn: '2026-11-02',
      steps: [
        { routineId: 'late', weeks: 1 },
        { routineId: 'early', weeks: 1 },
      ],
    };

    const active = activeRoutine([sundayNight, early], rotation, new Date(2026, 10, 9, 2));

    expect(active).toEqual({ routine: sundayNight, startedYesterday: true });
  });
});

describe('dayClashes', () => {
  it('names the routine created first as the one used on shared days outside the rotation', () => {
    expect(dayClashes([NORMAL, INTENSE], NO_ROTATION, INTENSE)).toEqual([
      { routine: NORMAL, days: [0, 1, 2, 3, 4], winsTheDays: true },
    ]);
  });

  it('tells the routine created first that it keeps the shared days', () => {
    expect(dayClashes([NORMAL, INTENSE], NO_ROTATION, NORMAL)[0].winsTheDays).toBe(false);
  });

  it('finds no clash between two routines the rotation alternates', () => {
    expect(dayClashes(ROUTINES, STUDY_PLAN, INTENSE)).toEqual([]);
  });

  it("lets the rotation's routine win over one outside it in its weeks", () => {
    const rotation: RoutineRotation = {
      ...STUDY_PLAN,
      steps: [{ routineId: 'intense', weeks: 1 }],
    };

    expect([
      dayClashes([NORMAL, INTENSE], rotation, NORMAL)[0].winsTheDays,
      dayClashes([NORMAL, INTENSE], rotation, INTENSE)[0].winsTheDays,
    ]).toEqual([true, false]);
  });

  it('finds no clash between routines on different weekdays', () => {
    expect(dayClashes([NORMAL, WEEKEND], NO_ROTATION, WEEKEND)).toEqual([]);
  });
});
