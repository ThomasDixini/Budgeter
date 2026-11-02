import { TestBed } from '@angular/core/testing';
import { openPage, text } from '../routines-page.testing';

describe('Today tasks', () => {
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
