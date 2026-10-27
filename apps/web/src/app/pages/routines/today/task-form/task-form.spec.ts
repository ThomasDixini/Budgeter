import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SAMPLE_CATEGORIES } from '../../../../core/routines/sample-routines';
import { TaskDraft } from '../../../../core/routines/task';
import { TaskForm } from './task-form';

/** Tuesday, as Monday = 0. */
const TUESDAY = 1;

function createForm(): { fixture: ComponentFixture<TaskForm>; created: TaskDraft[] } {
  const fixture = TestBed.createComponent(TaskForm);
  fixture.componentRef.setInput('categories', SAMPLE_CATEGORIES);
  fixture.componentRef.setInput('weekday', TUESDAY);
  const created: TaskDraft[] = [];
  fixture.componentInstance.create.subscribe((draft) => created.push(draft));
  fixture.detectChanges();
  return { fixture, created };
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

function clickChip(fixture: ComponentFixture<TaskForm>, label: string): void {
  const chips = [...element(fixture).querySelectorAll<HTMLButtonElement>('.ui-chip')];
  chips.find((chip) => chip.textContent?.trim() === label)!.click();
  fixture.detectChanges();
}

function submit(fixture: ComponentFixture<TaskForm>): void {
  element(fixture).querySelector<HTMLButtonElement>('[type="submit"]')!.click();
  fixture.detectChanges();
}

describe('TaskForm', () => {
  it('needs a title before it can add', () => {
    const { fixture } = createForm();

    expect(element(fixture).querySelector<HTMLButtonElement>('[type="submit"]')!.disabled).toBe(
      true,
    );
  });

  it('adds a one-off task by default', () => {
    const { fixture, created } = createForm();
    type(fixture, '  Call the bank ');

    submit(fixture);

    expect(created).toEqual([
      { title: 'Call the bank', categoryId: undefined, repeat: 'once', days: [] },
    ]);
  });

  it('links the task to a category', () => {
    const { fixture, created } = createForm();
    type(fixture, 'Read');
    const category = element(fixture).querySelector<HTMLSelectElement>('select')!;
    category.value = 'reading';
    category.dispatchEvent(new Event('change'));

    submit(fixture);

    expect(created[0].categoryId).toBe('reading');
  });

  it('repeats on some days, starting from today and sorted', () => {
    const { fixture, created } = createForm();
    type(fixture, 'Gym');
    clickChip(fixture, 'Some days');
    clickChip(fixture, 'Mon');
    clickChip(fixture, 'Fri');

    submit(fixture);

    expect(created[0]).toMatchObject({ repeat: 'weekly', days: [0, 1, 4] });
  });

  it('cannot repeat weekly on no day', () => {
    const { fixture, created } = createForm();
    type(fixture, 'Gym');
    clickChip(fixture, 'Some days');
    clickChip(fixture, 'Tue');

    submit(fixture);

    expect(created).toEqual([]);
  });
});
