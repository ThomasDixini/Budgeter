import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { Clock } from '../../core/calendar/clock';
import { FixedClock } from '../../core/calendar/fixed-clock';
import { RoutinesStore } from '../../core/routines/routines-store';

/** Monday 26 Oct 2026, 14:10: during the "C# study" block of the weekday routine. */
const STUDY_TIME = new Date(2026, 9, 26, 14, 10);

async function openPage(
  url: string,
  now = STUDY_TIME,
  prepare: (store: RoutinesStore) => void = () => undefined,
): Promise<HTMLElement> {
  TestBed.configureTestingModule({
    providers: [provideRouter(routes), { provide: Clock, useValue: new FixedClock(now) }],
  });
  prepare(TestBed.inject(RoutinesStore));
  const harness = await RouterTestingHarness.create(url);
  harness.detectChanges();
  return harness.routeNativeElement as HTMLElement;
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

  it('checks a task off', async () => {
    const element = await openPage('/routines');
    const checkbox = element.querySelectorAll<HTMLInputElement>('.task input')[2];

    checkbox.click();
    TestBed.tick();

    expect(text(element, '.title-with-count .ui-muted')).toBe('3/5');
  });
});
