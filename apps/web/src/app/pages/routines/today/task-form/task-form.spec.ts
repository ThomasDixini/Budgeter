import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SAMPLE_CATEGORIES } from '../../../../core/routines/sample-routines';
import { Task, TaskDraft } from '../../../../core/routines/task';
import { TaskForm } from './task-form';

/** Tuesday, as Monday = 0. */
const TUESDAY = 1;
const TODAY = '2026-10-27';

const GYM: Task = {
  id: 'gym',
  title: 'Gym',
  categoryId: 'exercise',
  repeat: 'weekly',
  days: [0, 4],
};
const CALL_BANK: Task = {
  id: 'call-bank',
  title: 'Call the bank',
  repeat: 'once',
  days: [],
  date: '2026-11-03',
};

function createForm(task?: Task): { fixture: ComponentFixture<TaskForm>; saved: TaskDraft[] } {
  const fixture = TestBed.createComponent(TaskForm);
  fixture.componentRef.setInput('categories', SAMPLE_CATEGORIES);
  fixture.componentRef.setInput('weekday', TUESDAY);
  fixture.componentRef.setInput('today', TODAY);
  if (task !== undefined) fixture.componentRef.setInput('task', task);
  const saved: TaskDraft[] = [];
  fixture.componentInstance.save.subscribe((draft) => saved.push(draft));
  fixture.detectChanges();
  return { fixture, saved };
}

function element(fixture: ComponentFixture<TaskForm>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function type(fixture: ComponentFixture<TaskForm>, value: string): void {
  const input = element(fixture).querySelector<HTMLInputElement>('input')!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

function setDate(fixture: ComponentFixture<TaskForm>, value: string): void {
  const input = element(fixture).querySelector<HTMLInputElement>('input[type="date"]')!;
  input.value = value;
  input.dispatchEvent(new Event('change'));
  fixture.detectChanges();
}

function clickChip(fixture: ComponentFixture<TaskForm>, label: string): void {
  const chips = [...element(fixture).querySelectorAll<HTMLButtonElement>('.ui-chip')];
  chips.find((chip) => chip.textContent?.trim() === label)!.click();
  fixture.detectChanges();
}

function submit(fixture: ComponentFixture<TaskForm>): void {
  element(fixture).querySelector<HTMLButtonElement>('[type="submit"]')!.click();
  fixture.detectChanges();
}

function dateField(fixture: ComponentFixture<TaskForm>): HTMLInputElement | null {
  return element(fixture).querySelector<HTMLInputElement>('input[type="date"]');
}

function pressedChips(fixture: ComponentFixture<TaskForm>): (string | undefined)[] {
  return [...element(fixture).querySelectorAll('.ui-chip[aria-pressed="true"]')].map((chip) =>
    chip.textContent?.trim(),
  );
}

describe('TaskForm', () => {
  it('needs a title before it can add', () => {
    const { fixture } = createForm();

    expect(element(fixture).querySelector<HTMLButtonElement>('[type="submit"]')!.disabled).toBe(
      true,
    );
  });

  it('adds a one-time task for today by default', () => {
    const { fixture, saved } = createForm();
    type(fixture, '  Call the bank ');

    submit(fixture);

    expect(saved).toEqual([
      { title: 'Call the bank', categoryId: undefined, repeat: 'once', days: [], date: TODAY },
    ]);
  });

  it('schedules a one-time task for another day', () => {
    const { fixture, saved } = createForm();
    type(fixture, 'Renew the passport');

    setDate(fixture, '2026-12-01');
    submit(fixture);

    expect(saved[0]).toMatchObject({ repeat: 'once', date: '2026-12-01' });
  });

  it('cannot add a one-time task with the day cleared', () => {
    const { fixture, saved } = createForm();
    type(fixture, 'Renew the passport');

    setDate(fixture, '');
    submit(fixture);

    expect(saved).toEqual([]);
  });

  // The date picker's `min` does not stop a day typed by hand.
  it('cannot add a one-time task for a day before today, even typed', () => {
    const { fixture, saved } = createForm();
    type(fixture, 'Renew the passport');

    setDate(fixture, '2026-10-01');
    submit(fixture);

    expect(saved).toEqual([]);
  });

  it('puts the cursor in the title when it opens', () => {
    const { fixture } = createForm();
    TestBed.tick();

    expect(document.activeElement).toBe(element(fixture).querySelector('input'));
  });

  it('offers no day for a task that repeats', () => {
    const { fixture } = createForm();

    clickChip(fixture, 'Every day');

    expect(dateField(fixture)).toBeNull();
  });

  it('links the task to a category', () => {
    const { fixture, saved } = createForm();
    type(fixture, 'Read');
    const category = element(fixture).querySelector<HTMLSelectElement>('select')!;
    category.value = 'reading';
    category.dispatchEvent(new Event('change'));

    submit(fixture);

    expect(saved[0].categoryId).toBe('reading');
  });

  it('repeats on some days, starting from today and sorted', () => {
    const { fixture, saved } = createForm();
    type(fixture, 'Gym');
    clickChip(fixture, 'Some days');
    clickChip(fixture, 'Mon');
    clickChip(fixture, 'Fri');

    submit(fixture);

    expect(saved[0]).toMatchObject({ repeat: 'weekly', days: [0, 1, 4], date: undefined });
  });

  it('cannot repeat weekly on no day', () => {
    const { fixture, saved } = createForm();
    type(fixture, 'Gym');
    clickChip(fixture, 'Some days');
    clickChip(fixture, 'Tue');

    submit(fixture);

    expect(saved).toEqual([]);
  });

  describe('editing', () => {
    it('opens with the task already filled in', () => {
      const { fixture } = createForm(GYM);

      expect(element(fixture).querySelector<HTMLInputElement>('input')!.value).toBe('Gym');
      expect(element(fixture).querySelector<HTMLSelectElement>('select')!.value).toBe('exercise');
      expect(pressedChips(fixture)).toEqual(['Some days', 'Mon', 'Fri']);
      expect(element(fixture).querySelector('form')?.getAttribute('aria-label')).toBe('Edit task');
      expect(element(fixture).querySelector('[type="submit"]')?.textContent?.trim()).toBe(
        'Save task',
      );
    });

    it('saves the changes', () => {
      const { fixture, saved } = createForm(GYM);
      type(fixture, 'Gym and swim');
      clickChip(fixture, 'Wed');

      submit(fixture);

      expect(saved).toEqual([
        {
          title: 'Gym and swim',
          categoryId: 'exercise',
          repeat: 'weekly',
          days: [0, 2, 4],
          date: undefined,
        },
      ]);
    });

    it('keeps the day of a scheduled task and lets it be moved', () => {
      const { fixture, saved } = createForm(CALL_BANK);
      expect(dateField(fixture)?.value).toBe('2026-11-03');

      setDate(fixture, '2026-11-10');
      submit(fixture);

      expect(saved[0]).toMatchObject({ repeat: 'once', date: '2026-11-10' });
    });

    it('turns a one-time task into a repeating one without keeping its day', () => {
      const { fixture, saved } = createForm(CALL_BANK);
      clickChip(fixture, 'Every day');

      submit(fixture);

      expect(saved[0]).toMatchObject({ repeat: 'daily', days: [], date: undefined });
    });

    // Regression, from the goals: a form reused for another record kept the previous one's values.
    it('refills when it is pointed at another task, without leaking the first one', () => {
      const { fixture } = createForm(GYM);
      type(fixture, 'Typed over the gym');

      fixture.componentRef.setInput('task', CALL_BANK);
      fixture.detectChanges();

      expect(element(fixture).querySelector<HTMLInputElement>('input')!.value).toBe(
        'Call the bank',
      );
      expect(pressedChips(fixture)).toEqual(['One time']);
      expect(dateField(fixture)?.value).toBe('2026-11-03');
    });

    it('lets an overdue task be saved with its own past day', () => {
      const overdue: Task = { ...CALL_BANK, date: '2026-10-01' };
      const { fixture, saved } = createForm(overdue);

      expect(dateField(fixture)?.min).toBe('2026-10-01');
      type(fixture, 'Call the bank back');
      submit(fixture);

      expect(saved[0]).toMatchObject({ title: 'Call the bank back', date: '2026-10-01' });
    });

    it('does not offer days before today for a task that is not overdue', () => {
      const { fixture } = createForm(CALL_BANK);

      expect(dateField(fixture)?.min).toBe(TODAY);
    });
  });
});
