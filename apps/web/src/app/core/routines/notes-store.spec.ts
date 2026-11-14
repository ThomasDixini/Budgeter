import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { IdGenerator } from '../ids/id-generator';
import { SequentialIdGenerator } from '../ids/sequential-id-generator';
import { FakeNotesGateway, SAMPLE_NOTES } from './fake-notes-gateway';
import { Note, NoteDraft } from './notes';
import { NotesGateway } from './notes-gateway';
import { NotesStore } from './notes-store';

const NEW_GOAL: NoteDraft = { kind: 'goal', title: 'Read more', body: '' };

function noteAt(id: string, updatedAt: string): Note {
  return {
    id,
    kind: 'note',
    title: id,
    body: '',
    status: 'open',
    createdAt: updatedAt,
    updatedAt,
  };
}

/** Records reported errors instead of logging them. */
class RecordingErrorHandler extends ErrorHandler {
  readonly errors: unknown[] = [];

  override handleError(error: unknown): void {
    this.errors.push(error);
  }
}

/** Lists that stay open until a test answers them, to play out overlapping loads. */
class ControlledListGateway extends FakeNotesGateway {
  readonly pendingLists: Subject<readonly Note[]>[] = [];

  override list(): Observable<readonly Note[]> {
    const reply = new Subject<readonly Note[]>();
    this.pendingLists.push(reply);
    return reply;
  }
}

function createStore(gateway: NotesGateway = new FakeNotesGateway()): {
  store: NotesStore;
  errors: RecordingErrorHandler;
} {
  const errors = new RecordingErrorHandler();
  TestBed.configureTestingModule({
    providers: [
      NotesStore,
      { provide: NotesGateway, useValue: gateway },
      { provide: IdGenerator, useValue: new SequentialIdGenerator() },
      { provide: ErrorHandler, useValue: errors },
    ],
  });
  return { store: TestBed.inject(NotesStore), errors };
}

describe('NotesStore', () => {
  it('loads the notes, most recently updated first', () => {
    const gateway = new FakeNotesGateway();
    gateway.notesToServe = [...SAMPLE_NOTES].reverse();

    const { store } = createStore(gateway);

    expect(store.notes().map((note) => note.id)).toEqual(SAMPLE_NOTES.map((note) => note.id));
    expect(store.isLoaded()).toBe(true);
    expect(store.hasLoadFailed()).toBe(false);
  });

  it('orders notes with the same update time by id', () => {
    const gateway = new FakeNotesGateway();
    gateway.notesToServe = [
      noteAt('b', '2026-11-01T10:00:00Z'),
      noteAt('a', '2026-11-01T10:00:00Z'),
    ];

    const { store } = createStore(gateway);

    expect(store.notes().map((note) => note.id)).toEqual(['a', 'b']);
  });

  it('reports a failed list and recovers on reload', () => {
    const gateway = new FakeNotesGateway();
    gateway.failure = new Error('list failed');
    const { store, errors } = createStore(gateway);
    expect(store.hasLoadFailed()).toBe(true);
    expect(store.isLoaded()).toBe(false);
    expect(errors.errors).toHaveLength(1);

    gateway.failure = undefined;
    store.reload();

    expect(store.hasLoadFailed()).toBe(false);
    expect(store.isLoaded()).toBe(true);
    expect(store.notes()).toHaveLength(SAMPLE_NOTES.length);
  });

  it('saves a new note under a generated id and shows it at the top', () => {
    const gateway = new FakeNotesGateway();
    const { store } = createStore(gateway);

    store.save(NEW_GOAL);

    expect(gateway.saved).toHaveLength(1);
    expect(gateway.saved[0].id).toBeTruthy();
    expect(gateway.saved[0].draft).toEqual(NEW_GOAL);
    expect(store.notes()[0].id).toBe(gateway.saved[0].id);
    expect(store.notes()).toHaveLength(SAMPLE_NOTES.length + 1);
  });

  it('replaces the note when saving under its id', () => {
    const gateway = new FakeNotesGateway();
    const { store } = createStore(gateway);

    store.save({ kind: 'note', title: 'Cambly 2', body: '' }, 'note-cambly');

    const matching = store.notes().filter((note) => note.id === 'note-cambly');
    expect(matching).toHaveLength(1);
    expect(matching[0].title).toBe('Cambly 2');
    expect(store.notes()).toHaveLength(SAMPLE_NOTES.length);
    expect(gateway.saved.map((call) => call.id)).toEqual(['note-cambly']);
  });

  it('counts each save the API accepts', () => {
    const { store } = createStore(new FakeNotesGateway());

    store.save(NEW_GOAL);
    store.save(NEW_GOAL, 'note-cambly');

    expect(store.savedCount()).toBe(2);
  });

  it('does not count a failed save or a status change as a save', () => {
    const gateway = new FakeNotesGateway();
    const { store } = createStore(gateway);

    store.setStatus('note-cambly', 'archived');
    gateway.failure = new Error('save failed');
    store.save(NEW_GOAL);

    expect(store.savedCount()).toBe(0);
  });

  it('flags a failed save, keeps the list and leaves the count', () => {
    const gateway = new FakeNotesGateway();
    const { store, errors } = createStore(gateway);
    gateway.failure = new Error('save failed');

    store.save(NEW_GOAL);

    expect(store.hasActionFailed()).toBe(true);
    expect(store.notes()).toEqual(SAMPLE_NOTES);
    expect(store.savedCount()).toBe(0);
    expect(errors.errors).toHaveLength(1);
  });

  it('saves a trimmed idea with an empty body', () => {
    const gateway = new FakeNotesGateway();
    const { store } = createStore(gateway);

    store.addIdea('  Call Ana  ');

    expect(gateway.saved).toHaveLength(1);
    expect(gateway.saved[0].draft).toEqual({ kind: 'idea', title: 'Call Ana', body: '' });
    expect(store.savedCount()).toBe(1);
  });

  it('ignores a blank idea', () => {
    const gateway = new FakeNotesGateway();
    const { store } = createStore(gateway);

    store.addIdea('   ');

    expect(gateway.saved).toEqual([]);
  });

  it('cuts an idea title to 80 characters', () => {
    const gateway = new FakeNotesGateway();
    const { store } = createStore(gateway);

    store.addIdea('x'.repeat(100));

    expect(gateway.saved[0].draft.title).toBe('x'.repeat(80));
  });

  it('updates the note in the list when its status changes', () => {
    const gateway = new FakeNotesGateway();
    const { store } = createStore(gateway);

    store.setStatus('note-cambly', 'archived');

    const changed = store.notes().find((note) => note.id === 'note-cambly');
    expect(changed?.status).toBe('archived');
    expect(gateway.statusChanges).toEqual([{ id: 'note-cambly', status: 'archived' }]);
    expect(store.notes()).toHaveLength(SAMPLE_NOTES.length);
  });

  it('removes a note from the list', () => {
    const gateway = new FakeNotesGateway();
    const { store } = createStore(gateway);

    store.remove('note-cambly');

    expect(gateway.deleted).toEqual(['note-cambly']);
    expect(store.notes().map((note) => note.id)).not.toContain('note-cambly');
    expect(store.notes()).toHaveLength(SAMPLE_NOTES.length - 1);
  });

  it('leaves the list unchanged when deleting an id that is not in it', () => {
    const { store } = createStore(new FakeNotesGateway());

    store.remove('missing');

    expect(store.notes()).toEqual(SAMPLE_NOTES);
    expect(store.hasActionFailed()).toBe(false);
  });

  it('flags failed status changes and deletes, keeping the list', () => {
    const gateway = new FakeNotesGateway();
    const { store } = createStore(gateway);
    gateway.failure = new Error('failed');

    store.setStatus('note-cambly', 'done');
    expect(store.hasActionFailed()).toBe(true);
    store.remove('note-cambly');

    expect(store.hasActionFailed()).toBe(true);
    expect(store.notes()).toEqual(SAMPLE_NOTES);
  });

  it('clears the action failure on the next action', () => {
    const gateway = new FakeNotesGateway();
    const { store } = createStore(gateway);
    gateway.failure = new Error('delete failed');
    store.remove('note-cambly');
    expect(store.hasActionFailed()).toBe(true);

    gateway.failure = undefined;
    store.remove('note-cambly');

    expect(store.hasActionFailed()).toBe(false);
  });

  it('lets the later answer win when two loads overlap', () => {
    const gateway = new ControlledListGateway();
    const { store } = createStore(gateway);
    store.reload();
    const [first, second] = gateway.pendingLists;

    second.next([noteAt('new', '2026-11-02T10:00:00Z')]);
    first.next([noteAt('old', '2026-11-01T10:00:00Z')]);

    expect(store.notes().map((note) => note.id)).toEqual(['new']);
  });
});
