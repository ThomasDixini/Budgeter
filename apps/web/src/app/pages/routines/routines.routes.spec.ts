import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
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

function focusTitles(element: HTMLElement): string[] {
  return [...element.querySelectorAll('.focus-goal-title')].map(
    (title) => title.textContent?.trim() ?? '',
  );
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

    expect(focusTitles(element)).toEqual([
      'Study C# 5x a week',
      'Finish the C# course',
      '10 new contacts this month',
    ]);
  });

  it('opens every goal with its progress from "See all", pending ones first, without leaving Today', async () => {
    const element = await openPage('/routines');

    clickButton(element, 'See all (7)');

    expect(focusTitles(element)).toEqual([
      'Study C# 5x a week',
      'Finish the C# course',
      '10 new contacts this month',
      'Attend 1 event',
      'Work out 3x a week',
      'Review notes every day',
      'Read 12 books in 2026',
    ]);
    expect(text(element, '#goals-title')).toBe('All goals');
    expect(element.querySelectorAll('.focus-goal.is-met')).toHaveLength(2);
    expect(TestBed.inject(Router).url).toBe('/routines');
  });

  it('shows each goal with its progress once opened', async () => {
    const element = await openPage('/routines');

    clickButton(element, 'See all (7)');

    const values = [...element.querySelectorAll('.focus-goal-value')].map((value) =>
      value.textContent?.trim(),
    );
    expect(values).toContain('3/5');
    expect(values).toContain('Achieved on Oct 20');
  });

  it('goes back to the goals in focus with "Show less"', async () => {
    const element = await openPage('/routines');
    clickButton(element, 'See all (7)');

    clickButton(element, 'Show less');

    expect(focusTitles(element)).toHaveLength(3);
    expect(text(element, '#goals-title')).toBe('Goals in focus');
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

  describe('editing and scheduling tasks', () => {
    function taskForms(element: HTMLElement): NodeListOf<HTMLElement> {
      return element.querySelectorAll<HTMLElement>('.task-form');
    }

    function editTask(element: HTMLElement, title: string): void {
      element.querySelector<HTMLButtonElement>(`[aria-label="Edit ${title}"]`)!.click();
      TestBed.tick();
    }

    function setField(
      element: HTMLElement,
      selector: string,
      value: string,
      event = 'input',
    ): void {
      const field = element.querySelector<HTMLInputElement>(selector)!;
      field.value = value;
      field.dispatchEvent(new Event(event));
      TestBed.tick();
    }

    function saveForm(element: HTMLElement): void {
      element.querySelector<HTMLButtonElement>('.task-form [type="submit"]')!.click();
      TestBed.tick();
    }

    function chip(element: HTMLElement, label: string): void {
      const chips = [...element.querySelectorAll<HTMLButtonElement>('.task-form .ui-chip')];
      chips.find((candidate) => candidate.textContent?.trim() === label)!.click();
      TestBed.tick();
    }

    function todayTitles(element: HTMLElement): string[] {
      return [...element.querySelectorAll('.tasks:not(.not-today) .task-title')].map(
        (title) => title.textContent ?? '',
      );
    }

    it('edits a task from its row, with the form filled in', async () => {
      const element = await openPage('/routines');

      editTask(element, 'Read 20 pages');
      expect(element.querySelector<HTMLInputElement>('.task-form input')!.value).toBe(
        'Read 20 pages',
      );
      setField(element, '.task-form input', 'Read 30 pages');
      saveForm(element);

      expect(taskForms(element)).toHaveLength(0);
      expect(todayTitles(element)).toContain('Read 30 pages');
      expect(todayTitles(element)).not.toContain('Read 20 pages');
    });

    // Regression, same family as the goals: another task's form must not reuse the first one's fields.
    it('opens the form of the task clicked, even with another one already open', async () => {
      const element = await openPage('/routines');

      editTask(element, 'Reply to pending emails');
      editTask(element, 'Read 20 pages');

      expect(taskForms(element)).toHaveLength(1);
      expect(element.querySelector<HTMLInputElement>('.task-form input')!.value).toBe(
        'Read 20 pages',
      );
    });

    it('closes the add form when editing starts, and the other way round', async () => {
      const element = await openPage('/routines');

      element.querySelector<HTMLButtonElement>('[aria-label="New task"]')!.click();
      TestBed.tick();
      editTask(element, 'Read 20 pages');
      expect(element.querySelector('.task-form')?.getAttribute('aria-label')).toBe('Edit task');
      element.querySelector<HTMLButtonElement>('[aria-label="New task"]')!.click();
      TestBed.tick();

      expect(taskForms(element)).toHaveLength(1);
      expect(element.querySelector('.task-form')?.getAttribute('aria-label')).toBe('New task');
    });

    it('lists tasks not due today under a collapsed "Not today"', async () => {
      const element = await openPage('/routines');

      expect(text(element, '.not-today-toggle')).toContain('Not today');
      expect(element.querySelector('.not-today')).toBeNull();
      element.querySelector<HTMLButtonElement>('.not-today-toggle')!.click();
      TestBed.tick();

      expect(text(element, '.not-today .task-title')).toBe('Do the LINQ exercises');
      expect(text(element, '.not-today .task-repeat')).toContain('Tue, Thu');
    });

    it('schedules a one-time task for another day: it leaves today and shows, marked, in "Not today"', async () => {
      const element = await openPage('/routines');
      editTask(element, 'Read 20 pages');

      chip(element, 'One time');
      setField(element, '.task-form input[type="date"]', '2026-11-02', 'change');
      saveForm(element);

      expect(todayTitles(element)).not.toContain('Read 20 pages');
      const row = element.querySelector('.not-today .is-highlighted');
      expect(row?.textContent).toContain('Read 20 pages');
      expect(row?.textContent).toContain('Nov 2');
    });

    it('returns the focus to the pencil that opened the form once it is saved', async () => {
      const element = await openPage('/routines');
      editTask(element, 'Read 20 pages');

      saveForm(element);

      expect(document.activeElement).toBe(
        element.querySelector('[aria-label="Edit Read 20 pages"]'),
      );
    });

    it('moves the focus to "Not today" when the task left the list the form was opened from', async () => {
      const element = await openPage('/routines');
      editTask(element, 'Read 20 pages');
      chip(element, 'One time');
      setField(element, '.task-form input[type="date"]', '2026-11-02', 'change');

      saveForm(element);

      expect(document.activeElement).toBe(element.querySelector('.not-today-toggle'));
    });

    it('keeps "Not today" closed when a task is saved for today', async () => {
      const element = await openPage('/routines');
      editTask(element, 'Read 20 pages');

      saveForm(element);

      expect(element.querySelector('.not-today')).toBeNull();
    });

    it('edits a task that is not due today', async () => {
      const element = await openPage('/routines');
      element.querySelector<HTMLButtonElement>('.not-today-toggle')!.click();
      TestBed.tick();

      editTask(element, 'Do the LINQ exercises');
      chip(element, 'Every day');
      saveForm(element);

      expect(todayTitles(element)).toContain('Do the LINQ exercises');
    });

    it('deletes a task that is not due today', async () => {
      const element = await openPage('/routines');
      element.querySelector<HTMLButtonElement>('.not-today-toggle')!.click();
      TestBed.tick();

      element
        .querySelector<HTMLButtonElement>('[aria-label="Delete Do the LINQ exercises"]')!
        .click();
      TestBed.tick();

      expect(element.querySelector('.not-today-toggle')).toBeNull();
    });
  });

  it('deletes a task', async () => {
    const element = await openPage('/routines');

    element.querySelector<HTMLButtonElement>('[aria-label="Delete Read 20 pages"]')!.click();
    TestBed.tick();

    expect(text(element, '.title-with-count .ui-muted')).toBe('0/3');
  });
});
