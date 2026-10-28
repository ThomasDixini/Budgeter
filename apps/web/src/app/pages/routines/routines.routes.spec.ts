import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { Clock } from '../../core/calendar/clock';
import { FixedClock } from '../../core/calendar/fixed-clock';
import { provideFakeRoutinesGateways } from '../../core/routines/fake-routines-gateways';
import { RoutinesStore } from '../../core/routines/routines-store';

/** Monday 26 Oct 2026, 14:10: during the "C# study" block of the weekday routine. */
const STUDY_TIME = new Date(2026, 9, 26, 14, 10);

async function openPage(
  url: string,
  now = STUDY_TIME,
  prepare: (store: RoutinesStore) => void = () => undefined,
): Promise<HTMLElement> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      { provide: Clock, useValue: new FixedClock(now) },
      ...provideFakeRoutinesGateways(),
    ],
  });
  prepare(TestBed.inject(RoutinesStore));
  const harness = await RouterTestingHarness.create(url);
  harness.detectChanges();
  return harness.routeNativeElement as HTMLElement;
}

function clickButton(element: HTMLElement, label: string): void {
  const buttons = [...element.querySelectorAll<HTMLButtonElement>('button')];
  buttons.find((button) => button.textContent?.trim() === label)!.click();
  TestBed.tick();
}

function text(element: HTMLElement, selector: string): string | undefined {
  return element.querySelector(selector)?.textContent?.trim();
}

describe('Routines & Goals routes', () => {
  it.each([
    ['/routines', 'Monday, October 26', 'Today'],
    ['/routines/routine', 'My routine', 'Routine'],
    ['/routines/categories', 'Categories', 'Categories & Goals'],
    ['/routines/categories/study', 'Study', 'Categories & Goals'],
  ])('opens %s with its tab selected', async (url, title, tab) => {
    const element = await openPage(url);

    expect(text(element, 'h1')).toBe(title);
    expect(text(element, '.tab[aria-current="page"]')).toBe(tab);
  });

  it('shows the module dock on every page', async () => {
    const element = await openPage('/routines/routine');

    expect(element.querySelector('app-module-dock')).not.toBeNull();
  });
});

describe('Today page', () => {
  it('highlights the block happening now', async () => {
    const element = await openPage('/routines');

    expect(text(element, '#now-title')).toBe('C# study');
    expect(text(element, '.block[aria-current="time"] .block-name')).toBe('C# study');
  });

  it('shows how much of the day has passed', async () => {
    const element = await openPage('/routines');

    expect(text(element, '.day-value')).toBe('69%');
  });

  it('points to the next block between blocks', async () => {
    const element = await openPage('/routines', new Date(2026, 9, 26, 7, 30));

    expect(text(element, '#now-title')).toBe('No block right now');
    expect(text(element, '.now-card .meta')).toContain('Next: Work at 08:00');
  });

  it('says when no routine runs today', async () => {
    const element = await openPage('/routines', STUDY_TIME, (store) =>
      store.saveRoutine({ ...store.routines()[0], days: [] }),
    );

    expect(element.querySelector('app-day-timeline')).toBeNull();
    expect(text(element, '.no-routine')).toContain('No routine runs today.');
  });

  it('lists the first three pending goals in focus', async () => {
    const element = await openPage('/routines');

    const titles = [...element.querySelectorAll('.focus-goal-title')].map(
      (title) => title.textContent,
    );

    expect(titles).toEqual([
      'Study C# 5x a week',
      'Finish the C# course',
      '10 new contacts this month',
    ]);
  });

  it('completes the running block and moves the rest of the day earlier', async () => {
    const element = await openPage('/routines');

    clickButton(element, 'Complete block');

    expect(text(element, '.now-card .title')).toBe('Networking');
    expect(text(element, '.now-card .meta .ui-tabular')).toBe('14:10 – 16:10');
    const study = element.querySelector('.block.is-done');
    expect(study?.textContent).toContain('C# study');
    expect(study?.textContent).toContain('13:30 – 14:10');
  });

  it('undoes a completed block from the Now card, back to plan', async () => {
    const element = await openPage('/routines');
    clickButton(element, 'Complete block');
    expect(text(element, '.last-ended span')).toBe('C# study completed');

    clickButton(element, 'Undo');

    expect(text(element, '.now-card .title')).toBe('C# study');
    expect(text(element, '.now-card .meta .ui-tabular')).toBe('13:30 – 15:00');
    expect(element.querySelector('.block.is-done')).toBeNull();
    expect(element.querySelector('.last-ended')).toBeNull();
  });

  it('undoes a skipped block from its button on the timeline', async () => {
    const element = await openPage('/routines');
    clickButton(element, 'Skip');

    element.querySelector<HTMLButtonElement>('[aria-label="Undo C# study"]')!.click();
    TestBed.tick();

    expect(element.querySelector('.block.is-skipped')).toBeNull();
    expect(text(element, '.now-card .title')).toBe('C# study');
  });

  it('skips the running block and crosses it out', async () => {
    const element = await openPage('/routines');

    clickButton(element, 'Skip');

    expect(element.querySelector('.block.is-skipped')?.textContent).toContain('C# study');
    expect(text(element, '.now-card .title')).toBe('Networking');
  });

  it('lists the tasks that repeat on today, a Monday', async () => {
    const element = await openPage('/routines');

    expect([...element.querySelectorAll('.task-title')].map((title) => title.textContent)).toEqual([
      'Reply to pending emails',
      'Review class notes',
      'Message 2 contacts',
      'Read 20 pages',
    ]);
    expect(text(element, '.task-repeat')).toBe('Every day');
  });

  it('checks a task off', async () => {
    const element = await openPage('/routines');
    const checkbox = element.querySelectorAll<HTMLInputElement>('.task input')[2];

    checkbox.click();
    TestBed.tick();

    expect(text(element, '.title-with-count .ui-muted')).toBe('1/4');
  });

  it('adds a task from the + button', async () => {
    const element = await openPage('/routines');
    element.querySelector<HTMLButtonElement>('[aria-label="New task"]')!.click();
    TestBed.tick();
    const title = element.querySelector<HTMLInputElement>('.task-form input')!;

    title.value = 'Call the bank';
    title.dispatchEvent(new Event('input'));
    TestBed.tick();
    element.querySelector<HTMLButtonElement>('.task-form [type="submit"]')!.click();
    TestBed.tick();

    expect(element.querySelector('.task-form')).toBeNull();
    expect([...element.querySelectorAll('.task-title')].at(-1)?.textContent).toBe('Call the bank');
  });

  it('deletes a task', async () => {
    const element = await openPage('/routines');

    element.querySelector<HTMLButtonElement>('[aria-label="Delete Read 20 pages"]')!.click();
    TestBed.tick();

    expect(text(element, '.title-with-count .ui-muted')).toBe('0/3');
  });
});
