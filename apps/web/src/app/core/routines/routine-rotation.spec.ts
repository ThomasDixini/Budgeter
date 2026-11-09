import {
  NO_ROTATION,
  RoutineRotation,
  cycleLength,
  isRotating,
  mondayOf,
  rotationWeek,
  stepWeeks,
  weekShare,
} from './routine-rotation';

/** Two weeks of Normal, one of Intense, one of Light, from Monday, November 2, 2026. */
const STUDY_PLAN: RoutineRotation = {
  startsOn: '2026-11-02',
  steps: [
    { routineId: 'normal', weeks: 2 },
    { routineId: 'intense', weeks: 1 },
    { routineId: 'light', weeks: 1 },
  ],
};

describe('mondayOf', () => {
  it.each([
    ['2026-11-02', '2026-11-02'],
    ['2026-11-05', '2026-11-02'],
    ['2026-11-08', '2026-11-02'],
    ['2027-01-01', '2026-12-28'],
  ])('moves %s to the Monday of its week, %s', (day, monday) => {
    expect(mondayOf(day)).toBe(monday);
  });
});

describe('cycleLength', () => {
  it('adds up the weeks of every step', () => {
    expect(cycleLength(STUDY_PLAN)).toBe(4);
  });

  it('is zero while the rotation is off', () => {
    expect(cycleLength(NO_ROTATION)).toBe(0);
  });
});

describe('rotationWeek', () => {
  it.each([
    ['2026-11-04', 1, 'normal'],
    ['2026-11-15', 2, 'normal'],
    ['2026-11-16', 3, 'intense'],
    ['2026-11-27', 4, 'light'],
    ['2026-11-30', 1, 'normal'],
  ])('places %s in week %i of the cycle, following %s', (day, week, routineId) => {
    expect(rotationWeek(STUDY_PLAN, day)).toEqual({ week, cycleLength: 4, routineId });
  });

  it('counts backwards through the cycle before its start', () => {
    expect(rotationWeek(STUDY_PLAN, '2026-10-28')?.routineId).toBe('light');
  });

  it('keeps the week across a daylight saving change', () => {
    const rotation: RoutineRotation = { startsOn: '2026-10-12', steps: STUDY_PLAN.steps };

    expect(rotationWeek(rotation, '2026-11-02')?.week).toBe(4);
  });

  it('is undefined while the rotation is off', () => {
    expect(rotationWeek(NO_ROTATION, '2026-11-04')).toBeUndefined();
  });
});

describe('stepWeeks', () => {
  it('lists the weeks of the cycle each step covers', () => {
    expect(stepWeeks(STUDY_PLAN)).toEqual([
      { from: 1, to: 2 },
      { from: 3, to: 3 },
      { from: 4, to: 4 },
    ]);
  });
});

describe('isRotating', () => {
  it('tells routines of the rotation from the others', () => {
    expect([isRotating(STUDY_PLAN, 'intense'), isRotating(STUDY_PLAN, 'weekend')]).toEqual([
      true,
      false,
    ]);
  });
});

describe('weekShare', () => {
  it('is the share of the cycle a routine of the rotation applies in', () => {
    expect(weekShare(STUDY_PLAN, 'normal')).toBe(0.5);
  });

  it('adds up a routine that comes back in a later step', () => {
    const rotation: RoutineRotation = {
      ...STUDY_PLAN,
      steps: [...STUDY_PLAN.steps, { routineId: 'intense', weeks: 4 }],
    };

    expect(weekShare(rotation, 'intense')).toBe(5 / 8);
  });

  it('is the whole week for a routine outside the rotation', () => {
    expect(weekShare(STUDY_PLAN, 'weekend')).toBe(1);
  });
});
