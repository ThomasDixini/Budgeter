import { MAX_ROTATION_STEPS, NO_ROTATION, RoutineRotation } from './routine-rotation';
import {
  sameRotation,
  withAddedStep,
  withStart,
  withStepRoutine,
  withStepWeeks,
  withoutRoutine,
  withoutStep,
} from './rotation-edits';

const PLAN: RoutineRotation = {
  startsOn: '2026-11-02',
  steps: [
    { routineId: 'normal', weeks: 2 },
    { routineId: 'light', weeks: 1 },
  ],
};

describe('withAddedStep', () => {
  it('starts a new plan on the Monday of this week', () => {
    expect(withAddedStep(NO_ROTATION, 'normal', '2026-11-05')).toEqual({
      startsOn: '2026-11-02',
      steps: [{ routineId: 'normal', weeks: 1 }],
    });
  });

  it('adds one week at the end and keeps the start of an existing plan', () => {
    const added = withAddedStep(PLAN, 'intense', '2026-12-10');

    expect(added.startsOn).toBe('2026-11-02');
    expect(added.steps.at(-1)).toEqual({ routineId: 'intense', weeks: 1 });
  });

  it('adds nothing once the plan has the most steps it may have', () => {
    const full: RoutineRotation = {
      startsOn: '2026-11-02',
      steps: Array.from({ length: MAX_ROTATION_STEPS }, () => ({ routineId: 'normal', weeks: 1 })),
    };

    expect(withAddedStep(full, 'light', '2026-11-05')).toBe(full);
  });
});

describe('withStepRoutine', () => {
  it('changes the routine of one step only', () => {
    expect(withStepRoutine(PLAN, 1, 'intense').steps).toEqual([
      { routineId: 'normal', weeks: 2 },
      { routineId: 'intense', weeks: 1 },
    ]);
  });
});

describe('withStepWeeks', () => {
  it.each([
    [3, 3],
    [0, 1],
    [40, 12],
    [2.6, 3],
  ])('makes %d weeks into %d', (weeks, expected) => {
    expect(withStepWeeks(PLAN, 0, weeks).steps[0].weeks).toBe(expected);
  });
});

describe('withoutStep', () => {
  it('removes the step at the index', () => {
    expect(withoutStep(PLAN, 0).steps).toEqual([{ routineId: 'light', weeks: 1 }]);
  });
});

describe('withStart', () => {
  it('starts the cycle on the Monday of the chosen week', () => {
    expect(withStart(PLAN, '2026-11-18').startsOn).toBe('2026-11-16');
  });
});

describe('withoutRoutine', () => {
  it('drops every step of a deleted routine', () => {
    expect(withoutRoutine(PLAN, 'normal').steps).toEqual([{ routineId: 'light', weeks: 1 }]);
  });
});

describe('sameRotation', () => {
  it('sees an equal plan as the same', () => {
    expect(sameRotation(PLAN, { ...PLAN, steps: PLAN.steps.map((step) => ({ ...step })) })).toBe(
      true,
    );
  });

  it('sees a changed step or start as different', () => {
    expect([
      sameRotation(PLAN, withStepWeeks(PLAN, 1, 2)),
      sameRotation(PLAN, withStart(PLAN, '2026-11-09')),
    ]).toEqual([false, false]);
  });

  it('ignores the start of two plans with no steps', () => {
    expect(sameRotation(NO_ROTATION, { startsOn: '2026-11-02', steps: [] })).toBe(true);
  });
});
