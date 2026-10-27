import { ErrorHandler } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER } from 'rxjs';
import {
  FakeRoutinesGateway,
  provideFakeRoutinesGateways,
} from '../../../core/routines/fake-routines-gateways';
import { RoutinesStore } from '../../../core/routines/routines-store';
import { RoutineEditor } from './routine-editor';

/** Swallows the rejected saves these tests provoke on purpose. */
class SilentErrorHandler extends ErrorHandler {
  override handleError(): void {
    // Expected failures; the editor's own message is what the tests check.
  }
}

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

function saveButton(fixture: ComponentFixture<RoutineEditor>): HTMLButtonElement {
  return element(fixture).querySelector<HTMLButtonElement>('.save')!;
}

function saveMessage(fixture: ComponentFixture<RoutineEditor>): string | undefined {
  return element(fixture).querySelector('.save-message')?.textContent?.trim();
}

async function save(fixture: ComponentFixture<RoutineEditor>): Promise<void> {
  click(fixture, '.save');
  await fixture.whenStable();
  fixture.detectChanges();
}

let routinesGateway: FakeRoutinesGateway;

describe('RoutineEditor', () => {
  beforeEach(() => {
    routinesGateway = new FakeRoutinesGateway();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        ...provideFakeRoutinesGateways(undefined, undefined, routinesGateway),
        { provide: ErrorHandler, useValue: new SilentErrorHandler() },
      ],
    });
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

  it('stacks overlapping blocks in lanes without warning', () => {
    const fixture = createEditor();
    const lunchStart = element(fixture).querySelectorAll<HTMLInputElement>('.time-input')[2];

    changeValue(fixture, lunchStart, '11:00');

    expect(element(fixture).querySelector('[role="status"]')).toBeNull();
    expect(element(fixture).querySelector<HTMLElement>('.bar')?.style.height).toBe('120px');
  });

  it('warns when a block ends before it starts', () => {
    const fixture = createEditor();
    const lunchEnd = element(fixture).querySelectorAll<HTMLInputElement>('.time-input')[3];

    changeValue(fixture, lunchEnd, '11:00');

    expect(element(fixture).querySelector('[role="status"]')?.textContent).toContain(
      '"Lunch" ends before it starts',
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

  it('saves the draft to the store only on save', async () => {
    const fixture = createEditor();
    const store = TestBed.inject(RoutinesStore);
    const dayEnd = element(fixture).querySelectorAll<HTMLInputElement>('.hours input')[1];
    changeValue(fixture, dayEnd, '18:00');
    expect(store.routines()[0].end).toBe('17:00');

    await save(fixture);

    expect(store.routines()[0].end).toBe('18:00');
  });

  it('keeps Save disabled until something changes', () => {
    const fixture = createEditor();

    expect(saveButton(fixture).disabled).toBe(true);
  });

  // Regression: linking a block to a category was lost because routines were never persisted.
  it('saves a block linked to a category through the gateway', async () => {
    const fixture = createEditor();
    const workCategory = element(fixture).querySelectorAll<HTMLSelectElement>('.select-input')[0];
    changeValue(fixture, workCategory, 'reading');

    await save(fixture);

    expect(routinesGateway.saved[0].blocks[0].categoryId).toBe('reading');
    expect(saveMessage(fixture)).toBe('All changes saved');
    expect(saveButton(fixture).disabled).toBe(true);
  });

  it('keeps the edits and says so when saving fails', async () => {
    const fixture = createEditor();
    routinesGateway.failure = new Error('offline');
    click(fixture, '.add-block');

    await save(fixture);

    expect(blockNames(fixture)).toContain('New block');
    expect(saveMessage(fixture)).toContain("Couldn't save");
    expect(saveButton(fixture).disabled).toBe(false);
  });

  it('gives new blocks ids from the id generator', async () => {
    const fixture = createEditor();
    click(fixture, '.add-block');

    await save(fixture);

    expect(routinesGateway.saved[0].blocks.at(-1)?.id).toBe('id-1');
  });

  it('waits for routines before showing the editor', () => {
    routinesGateway.list = () => NEVER;

    const fixture = createEditor();

    expect(element(fixture).querySelector('.empty')?.textContent?.trim()).toBe(
      'Loading your routines…',
    );
  });
});
