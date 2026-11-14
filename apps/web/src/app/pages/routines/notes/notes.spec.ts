import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../../app.routes';
import { fakeSession } from '../../../core/auth/fake-auth-gateway';
import { SessionStore } from '../../../core/auth/session-store';
import { provideFakeBackupGateway } from '../../../core/backups/fake-backup-gateway';
import { Clock } from '../../../core/calendar/clock';
import { FixedClock } from '../../../core/calendar/fixed-clock';
import { FakeNotesGateway } from '../../../core/routines/fake-notes-gateway';
import { provideFakeRoutinesGateways } from '../../../core/routines/fake-routines-gateways';
import { NotesGateway } from '../../../core/routines/notes-gateway';

async function openNotes(prepare: (gateway: FakeNotesGateway) => void = () => undefined) {
  const gateway = new FakeNotesGateway();
  prepare(gateway);
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      provideFakeBackupGateway(),
      { provide: Clock, useValue: new FixedClock(new Date(2026, 10, 12, 10, 0)) },
      { provide: NotesGateway, useValue: gateway },
      ...provideFakeRoutinesGateways(),
    ],
  });
  TestBed.inject(SessionStore).start(fakeSession(), false);
  const harness = await RouterTestingHarness.create('/routines/notes');
  harness.detectChanges();
  return { element: harness.routeNativeElement as HTMLElement, gateway };
}

function titles(element: HTMLElement): string[] {
  return [...element.querySelectorAll('app-note-item .title')].map(
    (node) => node.textContent?.trim() ?? '',
  );
}

function press(element: HTMLElement, selector: string): void {
  element.querySelector<HTMLElement>(selector)!.click();
  TestBed.tick();
}

function chip(element: HTMLElement, label: string): void {
  const chips = [...element.querySelectorAll<HTMLButtonElement>('.chips button')];
  chips.find((candidate) => candidate.textContent?.trim() === label)!.click();
  TestBed.tick();
}

function clickLabelled(element: HTMLElement, label: string): void {
  press(element, `[aria-label="${label}"]`);
}

function clickText(element: HTMLElement, label: string): void {
  const buttons = [...element.querySelectorAll<HTMLButtonElement>('button')];
  buttons.find((candidate) => candidate.textContent?.trim() === label)!.click();
  TestBed.tick();
}

function type(element: HTMLElement, selector: string, value: string): void {
  const field = element.querySelector<HTMLInputElement>(selector)!;
  field.value = value;
  field.dispatchEvent(new Event('input'));
  TestBed.tick();
}

function submit(element: HTMLElement, selector: string): void {
  element.querySelector<HTMLFormElement>(selector)!.dispatchEvent(new SubmitEvent('submit'));
  TestBed.tick();
}

describe('Notes page', () => {
  it('lists only the open notes at first, newest update first', async () => {
    const { element } = await openNotes();

    expect(titles(element)).toEqual(['Leave the comfort zone', 'Cambly', 'Sales call script']);
  });

  it('shows the done and the archived notes under their status chips', async () => {
    const { element } = await openNotes();

    chip(element, 'Done notes');
    expect(titles(element)).toEqual(['Start a podcast']);
    chip(element, 'Archived notes');
    expect(titles(element)).toEqual(['Old plans']);
  });

  it('marks the chip in use as pressed', async () => {
    const { element } = await openNotes();

    chip(element, 'Ideas');

    const pressed = [...element.querySelectorAll('.chips [aria-pressed="true"]')];
    expect(pressed.map((node) => node.textContent?.trim())).toEqual(['Ideas', 'Open notes']);
  });

  it('filters by kind', async () => {
    const { element } = await openNotes();

    chip(element, 'Ideas');

    expect(titles(element)).toEqual(['Sales call script']);
  });

  it('filters by the text of the title or the body', async () => {
    const { element } = await openNotes();

    type(element, 'input[type="search"]', 'tuesday');

    expect(titles(element)).toEqual(['Cambly']);
  });

  it('says nothing matches and clears the filters', async () => {
    const { element } = await openNotes();
    chip(element, 'Goals');
    type(element, 'input[type="search"]', 'cambly');

    expect(element.textContent).toContain('Nothing matches these filters.');
    clickText(element, 'Clear filters');

    expect(titles(element)).toHaveLength(3);
    expect(element.querySelector<HTMLInputElement>('input[type="search"]')!.value).toBe('');
  });

  it('shows nothing under Open when the search only matches archived notes', async () => {
    const { element } = await openNotes();

    type(element, 'input[type="search"]', 'old plans');

    expect(titles(element)).toEqual([]);
    expect(element.textContent).toContain('Nothing matches these filters.');
  });

  it('adds a quick idea and clears the field', async () => {
    const { element, gateway } = await openNotes();
    type(element, 'input[name="quickIdea"]', '  Call Ana  ');

    submit(element, '.quick-idea');

    expect(gateway.saved.map((call) => call.draft)).toEqual([
      { kind: 'idea', title: 'Call Ana', body: '' },
    ]);
    expect(element.querySelector<HTMLInputElement>('input[name="quickIdea"]')!.value).toBe('');
  });

  it('ignores a blank quick idea and keeps the text', async () => {
    const { element, gateway } = await openNotes();
    type(element, 'input[name="quickIdea"]', '   ');

    submit(element, '.quick-idea');

    expect(gateway.saved).toEqual([]);
    expect(element.querySelector<HTMLInputElement>('input[name="quickIdea"]')!.value).toBe('   ');
  });

  it('opens the form from New note, saves and closes it', async () => {
    const { element, gateway } = await openNotes();
    clickText(element, 'New note');
    type(element, 'input[name="title"]', 'Read more');

    submit(element, 'app-note-form form');

    expect(gateway.saved[0].draft).toEqual({ kind: 'idea', title: 'Read more', body: '' });
    expect(element.querySelector('app-note-form')).toBeNull();
    expect(titles(element)).toContain('Read more');
  });

  it('keeps the form open with an alert when the save fails', async () => {
    const { element, gateway } = await openNotes();
    clickText(element, 'New note');
    type(element, 'input[name="title"]', 'Read more');
    gateway.failure = new Error('offline');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    submit(element, 'app-note-form form');

    expect(element.querySelector('app-note-form')).not.toBeNull();
    expect(element.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
      'Could not save the note.',
    );
    expect(element.querySelector<HTMLInputElement>('input[name="title"]')!.value).toBe('Read more');
  });

  it('edits a note with its id', async () => {
    const { element, gateway } = await openNotes();
    clickLabelled(element, 'Edit note Cambly');
    type(element, 'input[name="title"]', 'Cambly class');

    submit(element, 'app-note-form form');

    expect(gateway.saved[0].id).toBe('note-cambly');
    expect(gateway.saved[0].draft.title).toBe('Cambly class');
  });

  it('marks an idea as done and reopens it', async () => {
    const { element, gateway } = await openNotes();
    clickLabelled(element, 'Mark note Sales call script as done');
    chip(element, 'Done notes');
    clickLabelled(element, 'Reopen note Start a podcast');

    expect(gateway.statusChanges).toEqual([
      { id: 'idea-sales-script', status: 'done' },
      { id: 'idea-podcast', status: 'open' },
    ]);
  });

  it('archives a note and restores it', async () => {
    const { element, gateway } = await openNotes();
    clickLabelled(element, 'Archive note Cambly');
    chip(element, 'Archived notes');
    clickLabelled(element, 'Restore note Old plans');

    expect(gateway.statusChanges).toEqual([
      { id: 'note-cambly', status: 'archived' },
      { id: 'note-old-plans', status: 'open' },
    ]);
  });

  it('deletes a note', async () => {
    const { element, gateway } = await openNotes();

    clickLabelled(element, 'Delete note Cambly');

    expect(gateway.deleted).toEqual(['note-cambly']);
    expect(titles(element)).not.toContain('Cambly');
  });

  it('says a status change failed while no form is open', async () => {
    const { element, gateway } = await openNotes();
    gateway.failure = new Error('offline');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    clickLabelled(element, 'Archive note Cambly');

    expect(element.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
      'Could not update the note.',
    );
  });

  it('offers to try again when the load fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { element, gateway } = await openNotes((fake) => {
      fake.failure = new Error('offline');
    });
    expect(element.textContent).toContain('Could not load the notes.');

    gateway.failure = undefined;
    clickText(element, 'Try again');

    expect(gateway.listCalls).toBe(2);
    expect(titles(element)).toHaveLength(3);
  });

  it('explains an empty page', async () => {
    const { element } = await openNotes((fake) => {
      fake.notesToServe = [];
    });

    expect(element.textContent).toContain('No notes yet. Write down a goal, a note or an idea.');
    expect(element.textContent).not.toContain('Nothing matches');
  });

  it('is reachable from its own tab, after History', async () => {
    const { element } = await openNotes();
    const tabs = [...element.ownerDocument.querySelectorAll('.tab')];

    expect(element.querySelector('h1')?.textContent?.trim()).toBe('Notes');
    expect(tabs.map((tab) => tab.textContent?.trim()).slice(-2)).toEqual(['History', 'Notes']);
    expect(element.ownerDocument.querySelector('.tab[aria-current="page"]')?.textContent).toContain(
      'Notes',
    );
  });
});
