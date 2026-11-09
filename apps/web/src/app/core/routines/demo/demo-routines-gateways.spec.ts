import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { Clock } from '../../calendar/clock';
import { FixedClock } from '../../calendar/fixed-clock';
import { BlockOutcome } from '../day-plan';
import { DemoRoutines } from './demo-routines';
import {
  DemoBlockOutcomesGateway,
  DemoCategoriesGateway,
  DemoGoalsGateway,
  DemoRoutineRotationGateway,
  DemoRoutinesGateway,
  DemoTasksGateway,
} from './demo-routines-gateways';

/** Wednesday, November 4, 2026, ten in the morning. */
const NOW = new Date(2026, 10, 4, 10, 0);
const TODAY = '2026-11-04';
const CSHARP_DONE: BlockOutcome = {
  routineId: 'weekdays',
  blockId: 'csharp',
  outcome: 'done',
  at: '15:00',
};

function setup(): {
  demo: DemoRoutines;
  routines: DemoRoutinesGateway;
  categories: DemoCategoriesGateway;
  goals: DemoGoalsGateway;
  tasks: DemoTasksGateway;
  outcomes: DemoBlockOutcomesGateway;
} {
  TestBed.configureTestingModule({
    providers: [
      { provide: Clock, useValue: new FixedClock(NOW) },
      DemoRoutinesGateway,
      DemoCategoriesGateway,
      DemoGoalsGateway,
      DemoTasksGateway,
      DemoBlockOutcomesGateway,
    ],
  });
  return {
    demo: TestBed.inject(DemoRoutines),
    routines: TestBed.inject(DemoRoutinesGateway),
    categories: TestBed.inject(DemoCategoriesGateway),
    goals: TestBed.inject(DemoGoalsGateway),
    tasks: TestBed.inject(DemoTasksGateway),
    outcomes: TestBed.inject(DemoBlockOutcomesGateway),
  };
}

describe('demo routines gateways', () => {
  it('keeps a routine that is saved and drops one that is deleted', async () => {
    const { routines } = setup();
    const [first] = await firstValueFrom(routines.list());

    await firstValueFrom(routines.save({ ...first, name: 'Renamed' }));
    expect((await firstValueFrom(routines.list()))[0].name).toBe('Renamed');

    await firstValueFrom(routines.delete(first.id));
    const left = await firstValueFrom(routines.list());
    expect(left.some((item) => item.id === first.id)).toBe(false);
  });

  it('records a block outcome and takes it back', async () => {
    const { outcomes } = setup();

    await firstValueFrom(outcomes.record(TODAY, CSHARP_DONE));
    expect(await firstValueFrom(outcomes.list(TODAY))).toContainEqual(CSHARP_DONE);

    await firstValueFrom(outcomes.undo(TODAY, 'weekdays', 'csharp'));
    const listed = await firstValueFrom(outcomes.list(TODAY));
    expect(listed.some((item) => item.blockId === 'csharp')).toBe(false);
  });

  it('marks a task done on a day and unmarks it', async () => {
    const { tasks } = setup();

    await firstValueFrom(tasks.setDone('water', '2026-11-03', true));
    expect(await firstValueFrom(tasks.completedOn('2026-11-03'))).toContain('water');

    await firstValueFrom(tasks.setDone('water', '2026-11-03', false));
    expect(await firstValueFrom(tasks.completedOn('2026-11-03'))).not.toContain('water');
  });

  it('counts a completed block on the frequency goal of its category', async () => {
    const { goals, outcomes } = setup();
    await firstValueFrom(outcomes.undo(TODAY, 'weekdays', 'csharp'));
    const before = (await firstValueFrom(goals.list(TODAY))).find((g) => g.id === 'goal-csharp');

    await firstValueFrom(outcomes.record(TODAY, CSHARP_DONE));
    const after = (await firstValueFrom(goals.list(TODAY))).find((g) => g.id === 'goal-csharp');

    expect(after?.done).toBe((before?.done ?? 0) + 1);
  });

  it('marks an objective achieved on the day and takes the mark back', async () => {
    const { goals } = setup();

    const achieved = await firstValueFrom(goals.setAchievement('goal-course', TODAY, true));
    expect(achieved.achievedOn).toBe(TODAY);
    expect(achieved.done).toBe(achieved.target);

    const undone = await firstValueFrom(goals.setAchievement('goal-course', TODAY, false));
    expect(undone.achievedOn).toBeUndefined();
    expect(undone.done).toBe(0);
  });

  it('refuses to edit a goal that does not exist, naming it', async () => {
    const { goals } = setup();
    const changes = { title: 'x', period: 'daily', target: 1 } as const;

    await expect(firstValueFrom(goals.update('nope', changes, TODAY))).rejects.toThrow(
      'Expected a known goal id, received "nope"',
    );
  });

  it('drops the goals of a deleted category and frees its blocks and tasks', async () => {
    const { categories, demo } = setup();

    await firstValueFrom(categories.delete('study'));

    expect(demo.goals.some((goal) => goal.categoryId === 'study')).toBe(false);
    const blocks = demo.routines.flatMap((routine) => routine.blocks);
    expect(blocks.some((block) => block.categoryId === 'study')).toBe(false);
    expect(demo.tasks.some((task) => task.categoryId === 'study')).toBe(false);
  });
});

describe('demo routine rotation gateway', () => {
  function rotationSetup(): {
    rotation: DemoRoutineRotationGateway;
    routines: DemoRoutinesGateway;
  } {
    TestBed.configureTestingModule({
      providers: [
        { provide: Clock, useValue: new FixedClock(NOW) },
        DemoRoutineRotationGateway,
        DemoRoutinesGateway,
      ],
    });
    return {
      rotation: TestBed.inject(DemoRoutineRotationGateway),
      routines: TestBed.inject(DemoRoutinesGateway),
    };
  }

  it('starts off and keeps a saved rotation from the Monday of its week', async () => {
    const { rotation } = rotationSetup();
    const before = await firstValueFrom(rotation.get());

    await firstValueFrom(
      rotation.save({ startsOn: TODAY, steps: [{ routineId: 'weekdays', weeks: 2 }] }),
    );

    expect([before.steps, await firstValueFrom(rotation.get())]).toEqual([
      [],
      { startsOn: '2026-11-02', steps: [{ routineId: 'weekdays', weeks: 2 }] },
    ]);
  });

  it('drops the steps of a deleted routine', async () => {
    const { rotation, routines } = rotationSetup();
    await firstValueFrom(
      rotation.save({ startsOn: TODAY, steps: [{ routineId: 'weekdays', weeks: 2 }] }),
    );

    await firstValueFrom(routines.delete('weekdays'));

    expect((await firstValueFrom(rotation.get())).steps).toEqual([]);
  });
});
