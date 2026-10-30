import { ErrorHandler } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER } from 'rxjs';
import {
  FakeRoutinesGateway,
  provideFakeRoutinesGateways,
} from '../../../core/routines/fake-routines-gateways';
import { RoutinesGateway } from '../../../core/routines/routines-gateway';
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

function tabNames(fixture: ComponentFixture<RoutineEditor>): (string | undefined)[] {
  return [...element(fixture).querySelectorAll('[role="tab"]')].map((tab) =>
    tab.textContent?.trim(),
  );
}

function selectedTab(fixture: ComponentFixture<RoutineEditor>): string | undefined {
  return element(fixture).querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim();
}

function saveButton(fixture: ComponentFixture<RoutineEditor>): HTMLButtonElement {
  return element(fixture).querySelector<HTMLButtonElement>('.save')!;
}

function saveMessage(fixture: ComponentFixture<RoutineEditor>): string | undefined {
  return element(fixture).querySelector('.save-message')?.textContent?.trim();
}

/** Planned and free time per day, as the summary shows them. */
function tileValues(fixture: ComponentFixture<RoutineEditor>): (string | undefined)[] {
  return [...element(fixture).querySelectorAll('.tile-value')].map((tile) =>
    tile.textContent?.trim(),
  );
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

  it('warns when a block starts and ends at the same time', () => {
    const fixture = createEditor();
    const lunchEnd = element(fixture).querySelectorAll<HTMLInputElement>('.time-input')[3];

    changeValue(fixture, lunchEnd, '12:00');

    expect(element(fixture).querySelector('[role="status"]')?.textContent).toContain(
      '"Lunch" starts and ends at the same time',
    );
  });

  // Regression: 00:00–00:00 used to be a one-minute day instead of the whole 24 hours.
  it('partitions a full day from midnight to midnight', () => {
    const fixture = createEditor();
    const [dayStart, dayEnd] = element(fixture).querySelectorAll<HTMLInputElement>('.hours input');

    changeValue(fixture, dayStart, '00:00');
    changeValue(fixture, dayEnd, '00:00');

    expect(element(fixture).querySelector('.partition-card .ui-muted')?.textContent).toBe(
      '00:00 – 00:00',
    );
    expect(tileValues(fixture)).toEqual(['9h', '15h']);
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

  it('opens a blank, unsaved routine from "New routine"', () => {
    const fixture = createEditor();

    click(fixture, '.new-routine');

    expect(selectedTab(fixture)).toBe('New routine');
    expect(blockNames(fixture)).toEqual([]);
    expect(saveButton(fixture).disabled).toBe(false);
    expect(saveMessage(fixture)).toBe('Unsaved changes');
  });

  it('saves a new routine under the name the user gives it', async () => {
    const fixture = createEditor();
    click(fixture, '.new-routine');
    changeValue(
      fixture,
      element(fixture).querySelector<HTMLInputElement>('.routine-name input')!,
      'Night shift',
    );
    click(fixture, '.day', 6);

    await save(fixture);

    expect(routinesGateway.saved[0]).toMatchObject({ id: 'id-1', name: 'Night shift', days: [6] });
    expect(selectedTab(fixture)).toBe('Night shift');
    expect(saveMessage(fixture)).toBe('All changes saved');
  });

  it('keeps an unsaved new routine while switching tabs', () => {
    const fixture = createEditor();
    click(fixture, '.new-routine');

    click(fixture, '[role="tab"]', 0);

    expect(tabNames(fixture)).toEqual(['Weekdays', 'Weekend', 'New routine']);
  });

  it('asks before deleting and keeps the routine on Cancel', () => {
    const fixture = createEditor();

    click(fixture, '.delete-routine');
    expect(element(fixture).querySelector('.delete-confirm')?.textContent).toContain(
      'Delete "Weekdays" and its blocks?',
    );
    click(fixture, '.delete-confirm .ui-button-ghost', 1);

    expect(tabNames(fixture)).toEqual(['Weekdays', 'Weekend']);
    expect(routinesGateway.deleted).toEqual([]);
  });

  it('deletes the routine on confirm and opens the next one', async () => {
    const fixture = createEditor();

    click(fixture, '.delete-routine');
    click(fixture, '.delete-yes');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(routinesGateway.deleted).toEqual(['weekdays']);
    expect(tabNames(fixture)).toEqual(['Weekend']);
    expect(selectedTab(fixture)).toBe('Weekend');
  });

  it('discards an unsaved new routine without calling the API', async () => {
    const fixture = createEditor();
    click(fixture, '.new-routine');

    click(fixture, '.delete-routine');
    click(fixture, '.delete-yes');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(tabNames(fixture)).toEqual(['Weekdays', 'Weekend']);
    expect(routinesGateway.deleted).toEqual([]);
  });

  it('keeps the routine and says so when deleting fails', async () => {
    const fixture = createEditor();
    routinesGateway.failure = new Error('offline');

    click(fixture, '.delete-routine');
    click(fixture, '.delete-yes');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(tabNames(fixture)).toEqual(['Weekdays', 'Weekend']);
    expect(saveMessage(fixture)).toBe("Couldn't delete the routine. Try again.");
  });

  it('offers "New routine" when there are no routines yet', () => {
    routinesGateway = new FakeRoutinesGateway([]);
    TestBed.overrideProvider(RoutinesGateway, { useValue: routinesGateway });
    const fixture = createEditor();

    click(fixture, '.new-routine');

    expect(selectedTab(fixture)).toBe('New routine');
  });

  it('waits for routines before showing the editor', () => {
    routinesGateway.list = () => NEVER;

    const fixture = createEditor();

    expect(element(fixture).querySelector('.empty')?.textContent?.trim()).toBe(
      'Loading your routines…',
    );
  });
});
