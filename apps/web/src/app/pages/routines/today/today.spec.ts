import { fakeSession } from '../../../core/auth/fake-auth-gateway';
import { SessionStore } from '../../../core/auth/session-store';
import { provideFakeBackupGateway } from '../../../core/backups/fake-backup-gateway';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../../app.routes';
import { Clock } from '../../../core/calendar/clock';
import { FixedClock } from '../../../core/calendar/fixed-clock';
import { FakeBlockOutcomesGateway } from '../../../core/routines/fake-block-outcomes-gateway';
import { FakeRoutineRotationGateway } from '../../../core/routines/fake-routine-rotation-gateway';
import {
  FakeCategoriesGateway,
  FakeGoalsGateway,
  FakeRoutinesGateway,
  provideFakeRoutinesGateways,
} from '../../../core/routines/fake-routines-gateways';
import { Routine } from '../../../core/routines/routine';
import { SAMPLE_ROUTINES } from '../../../core/routines/sample-routines';

/** A clock the test moves by hand. */
class MovableClock extends Clock {
  constructor(private moment: Date) {
    super();
  }

  moveTo(moment: Date): void {
    this.moment = moment;
  }

  override now(): Date {
    return new Date(this.moment);
  }
}

const NIGHT_SHIFT: Routine = {
  id: 'night',
  name: 'Night shift',
  days: [0],
  start: '22:00',
  end: '06:00',
  blocks: [{ id: 'patrol', name: 'Patrol', start: '23:00', end: '05:00' }],
};

async function openToday(
  clock: Clock,
  routines: readonly Routine[] = SAMPLE_ROUTINES,
  outcomes = new FakeBlockOutcomesGateway(),
  rotation = new FakeRoutineRotationGateway(),
): Promise<HTMLElement> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      provideFakeBackupGateway(),
      { provide: Clock, useValue: clock },
      ...provideFakeRoutinesGateways(
        new FakeCategoriesGateway(),
        new FakeGoalsGateway(),
        new FakeRoutinesGateway(routines),
        undefined,
        outcomes,
        rotation,
      ),
    ],
  });
  TestBed.inject(SessionStore).start(fakeSession(), false);
  const harness = await RouterTestingHarness.create('/routines');
  harness.detectChanges();
  return harness.routeNativeElement as HTMLElement;
}

function text(element: HTMLElement, selector: string): string | undefined {
  return element.querySelector(selector)?.textContent?.trim();
}

function press(element: HTMLElement, label: string): void {
  element.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click();
  TestBed.tick();
}

describe('Today clock', () => {
  afterEach(() => vi.useRealTimers());

  it('moves the Now card on as time passes, without a reload', async () => {
    vi.useFakeTimers();
    const clock = new MovableClock(new Date(2026, 9, 26, 14, 10));
    const element = await openToday(clock);
    expect(text(element, '#now-title')).toBe('C# study');

    clock.moveTo(new Date(2026, 9, 26, 15, 30));
    vi.advanceTimersByTime(30_000);
    TestBed.tick();

    expect(text(element, '#now-title')).toBe('Networking');
  });

  // Regression: past midnight the task list stayed on the day the page was opened.
  it('moves the task list on to the new day past midnight, without a reload', async () => {
    vi.useFakeTimers();
    const clock = new MovableClock(new Date(2026, 9, 26, 23, 59));
    const element = await openToday(clock);
    const titles = (): string[] =>
      [...element.querySelectorAll('.tasks:not(.not-today) .task-title')].map(
        (title) => title.textContent?.trim() ?? '',
      );
    expect(titles()).not.toContain('Do the LINQ exercises');

    clock.moveTo(new Date(2026, 9, 27, 0, 1));
    vi.advanceTimersByTime(30_000);
    TestBed.tick();

    expect(titles()).toContain('Do the LINQ exercises');
  });

  it('stops ticking when the page goes away', async () => {
    vi.useFakeTimers();
    await openToday(new MovableClock(new Date(2026, 9, 26, 14, 10)));

    TestBed.resetTestingModule();

    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('Today with a routine that runs past midnight', () => {
  const routines = [{ ...SAMPLE_ROUTINES[0], days: [1, 2, 3, 4] }, SAMPLE_ROUTINES[1], NIGHT_SHIFT];

  it("keeps Monday's night shift running on Tuesday at 02:00", async () => {
    const outcomes = new FakeBlockOutcomesGateway();

    const element = await openToday(
      new FixedClock(new Date(2026, 9, 27, 2, 0)),
      routines,
      outcomes,
    );

    expect(text(element, '.timeline-card .card-header .ui-muted')).toContain('Night shift');
    expect(text(element, '#now-title')).toBe('Patrol');
    expect(outcomes.listedDays.at(-1)).toBe('2026-10-26');
  });

  it("uses Tuesday's own routine again after the night shift ends", async () => {
    const element = await openToday(new FixedClock(new Date(2026, 9, 27, 10, 0)), routines);

    expect(text(element, '.timeline-card .card-header .ui-muted')).toContain('Weekdays');
  });

  it('records a block of the night shift on the day it began', async () => {
    const outcomes = new FakeBlockOutcomesGateway();
    const element = await openToday(
      new FixedClock(new Date(2026, 9, 27, 2, 0)),
      routines,
      outcomes,
    );

    press(element, 'Complete Patrol');

    expect(outcomes.recorded.at(-1)?.isoDay).toBe('2026-10-26');
  });
});

describe('Today with a rotation plan', () => {
  const intense: Routine = { ...SAMPLE_ROUTINES[0], id: 'intense', name: 'Intense', end: '22:00' };
  const routines = [...SAMPLE_ROUTINES, intense];
  /** Two weeks of the weekday routine, then one of "Intense", from Monday, October 26, 2026. */
  const plan = (): FakeRoutineRotationGateway =>
    new FakeRoutineRotationGateway({
      startsOn: '2026-10-26',
      steps: [
        { routineId: 'weekdays', weeks: 2 },
        { routineId: 'intense', weeks: 1 },
      ],
    });
  const header = '.timeline-card .card-header';

  it("follows the routine of this week's step and says which week of the cycle it is", async () => {
    const wednesdayOfWeekThree = new FixedClock(new Date(2026, 10, 11, 10, 0));

    const element = await openToday(wednesdayOfWeekThree, routines, undefined, plan());

    expect(text(element, `${header} .ui-muted`)).toContain('Intense');
    expect(text(element, `${header} .rotation-week`)).toBe('Week 3 of 3');
  });

  it('starts the cycle over after its last step', async () => {
    const element = await openToday(
      new FixedClock(new Date(2026, 10, 16, 10, 0)),
      routines,
      undefined,
      plan(),
    );

    expect(text(element, `${header} .ui-muted`)).toContain('Weekdays');
    expect(text(element, `${header} .rotation-week`)).toBe('Week 1 of 3');
  });

  it('keeps a routine outside the plan on its days, without a week badge', async () => {
    const saturday = new FixedClock(new Date(2026, 10, 14, 10, 0));

    const element = await openToday(saturday, routines, undefined, plan());

    expect(text(element, `${header} .ui-muted`)).toContain('Weekend');
    expect(element.querySelector(`${header} .rotation-week`)).toBeNull();
  });
});

describe('Today completing any block', () => {
  const STUDY_TIME = new Date(2026, 9, 26, 14, 10);

  it('completes a block that is still ahead without moving the others', async () => {
    const element = await openToday(new FixedClock(STUDY_TIME));

    press(element, 'Complete Networking');

    expect(element.querySelector('.block.is-done')?.textContent).toContain('Networking');
    expect(text(element, '#now-title')).toBe('C# study');
    expect(text(element, '.now-card .meta .ui-tabular')).toBe('13:30 – 15:00');
  });

  it('skips a block that is already over', async () => {
    const element = await openToday(new FixedClock(STUDY_TIME));

    press(element, 'Skip Work');

    expect(element.querySelector('.block.is-skipped')?.textContent).toContain('Work');
    expect(text(element, '#now-title')).toBe('C# study');
  });

  it('offers no complete or skip button on a block that already ended', async () => {
    const element = await openToday(new FixedClock(STUDY_TIME));
    press(element, 'Skip Work');

    expect(element.querySelector('[aria-label="Complete Work"]')).toBeNull();
    expect(element.querySelector('[aria-label="Undo Work"]')).not.toBeNull();
  });
});

describe('Today filtering tasks by block', () => {
  const STUDY_TIME = new Date(2026, 9, 26, 14, 10);

  function taskTitles(element: HTMLElement): string[] {
    return [...element.querySelectorAll('.tasks:not(.not-today) .task-title')].map(
      (title) => title.textContent?.trim() ?? '',
    );
  }

  it('shows every task of the day when no block is picked', async () => {
    const element = await openToday(new FixedClock(STUDY_TIME));

    expect(taskTitles(element).length).toBeGreaterThan(2);
    expect(element.querySelector('.block-filter')).toBeNull();
  });

  it('keeps only the tasks sharing the category of the picked block', async () => {
    const element = await openToday(new FixedClock(STUDY_TIME));
    const all = taskTitles(element);

    press(element, 'Show tasks for Networking');

    const shown = taskTitles(element);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.length).toBeLessThan(all.length);
    const categories = [...element.querySelectorAll('.tasks:not(.not-today) .task-category')];
    expect(categories.every((category) => category.textContent?.includes('Networking'))).toBe(true);
    expect(text(element, '.block-filter span')).toBe('Tasks for Networking');
  });

  it('shows every task again when the picked block is clicked once more', async () => {
    const element = await openToday(new FixedClock(STUDY_TIME));
    const all = taskTitles(element);
    press(element, 'Show tasks for Networking');

    press(element, 'Show tasks for Networking');

    expect(taskTitles(element)).toEqual(all);
  });

  it('shows every task again from the "Show all" link', async () => {
    const element = await openToday(new FixedClock(STUDY_TIME));
    const all = taskTitles(element);
    press(element, 'Show tasks for Networking');

    element.querySelector<HTMLButtonElement>('.block-filter button')!.click();
    TestBed.tick();

    expect(taskTitles(element)).toEqual(all);
  });

  it('shows only uncategorized tasks for a block with no category', async () => {
    const element = await openToday(new FixedClock(STUDY_TIME));

    press(element, 'Show tasks for Lunch');

    expect(taskTitles(element)).toContain('Reply to pending emails');
    expect(element.querySelector('.tasks:not(.not-today) .task-category')).toBeNull();
  });
});
