import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RoutinesStore } from '../../../core/routines/routines-store';
import { RoutineEditor } from './routine-editor';

function createEditor(): ComponentFixture<RoutineEditor> {
  const fixture = TestBed.createComponent(RoutineEditor);
  fixture.detectChanges();
  return fixture;
}

function element(fixture: ComponentFixture<RoutineEditor>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function changeValue(
  fixture: ComponentFixture<RoutineEditor>,
  field: HTMLInputElement | HTMLSelectElement,
  value: string,
): void {
  field.value = value;
  field.dispatchEvent(new Event('change'));
  fixture.detectChanges();
}

function click(fixture: ComponentFixture<RoutineEditor>, selector: string, index = 0): void {
  element(fixture).querySelectorAll<HTMLButtonElement>(selector)[index].click();
  fixture.detectChanges();
}

function blockNames(fixture: ComponentFixture<RoutineEditor>): string[] {
  return [...element(fixture).querySelectorAll<HTMLInputElement>('.name-input')].map(
    (input) => input.value,
  );
}

describe('RoutineEditor', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('starts on the weekday routine', () => {
    const fixture = createEditor();

    expect(
      element(fixture).querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim(),
    ).toBe('Weekdays');
  });

  it('switches to another routine template', () => {
    const fixture = createEditor();

    click(fixture, '[role="tab"]', 1);

    expect(blockNames(fixture)).toEqual(['Workout', 'Reading', 'Lunch']);
  });

  it('toggles a weekday', () => {
    const fixture = createEditor();

    click(fixture, '.day', 5);

    expect(element(fixture).querySelectorAll('.day')[5].getAttribute('aria-pressed')).toBe('true');
  });

  it('adds and removes blocks', () => {
    const fixture = createEditor();

    click(fixture, '.add-block');
    click(fixture, '.remove', 0);

    expect(blockNames(fixture)).toEqual(['Lunch', 'C# study', 'Networking', 'New block']);
  });

  it('warns when blocks overlap', () => {
    const fixture = createEditor();
    const lunchStart = element(fixture).querySelectorAll<HTMLInputElement>('.time-input')[2];

    changeValue(fixture, lunchStart, '11:00');

    expect(element(fixture).querySelector('[role="status"]')?.textContent).toContain(
      '"Work" and "Lunch" overlap',
    );
  });

  it('ignores a cleared time field', () => {
    const fixture = createEditor();
    const dayEnd = element(fixture).querySelectorAll<HTMLInputElement>('.hours input')[1];

    changeValue(fixture, dayEnd, '');

    expect(element(fixture).querySelector('.partition-card .ui-muted')?.textContent).toBe(
      '08:00 – 17:00',
    );
  });

  it('updates the summary when a block changes category', () => {
    const fixture = createEditor();
    const workCategory = element(fixture).querySelectorAll<HTMLSelectElement>('.select-input')[0];

    changeValue(fixture, workCategory, 'reading');

    expect(
      [...element(fixture).querySelectorAll('.category-name')].map((name) =>
        name.textContent?.trim(),
      ),
    ).toContain('Reading');
  });

  it('saves the draft to the store only on save', () => {
    const fixture = createEditor();
    const store = TestBed.inject(RoutinesStore);
    const dayEnd = element(fixture).querySelectorAll<HTMLInputElement>('.hours input')[1];
    changeValue(fixture, dayEnd, '18:00');
    expect(store.routines()[0].end).toBe('17:00');

    click(fixture, '.save');

    expect(store.routines()[0].end).toBe('18:00');
  });
});
