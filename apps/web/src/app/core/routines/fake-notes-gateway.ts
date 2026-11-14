import { Observable, of, throwError } from 'rxjs';
import { Note, NoteDraft, NoteStatus } from './notes';
import { NotesGateway } from './notes-gateway';

const SAVED_AT = '2026-11-12T10:00:00Z';

/** One note of each kind and status, with distinct update times. */
export const SAMPLE_NOTES: readonly Note[] = [
  {
    id: 'goal-comfort-zone',
    kind: 'goal',
    title: 'Leave the comfort zone',
    body: '',
    status: 'open',
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-07T10:00:00Z',
  },
  {
    id: 'note-cambly',
    kind: 'note',
    title: 'Cambly',
    body: 'Book a session on Tuesday.\nPrepare three topics.',
    status: 'open',
    createdAt: '2026-11-02T10:00:00Z',
    updatedAt: '2026-11-06T10:00:00Z',
  },
  {
    id: 'idea-sales-script',
    kind: 'idea',
    title: 'Sales call script',
    body: '',
    status: 'open',
    createdAt: '2026-11-03T10:00:00Z',
    updatedAt: '2026-11-05T10:00:00Z',
  },
  {
    id: 'idea-podcast',
    kind: 'idea',
    title: 'Start a podcast',
    body: '',
    status: 'done',
    createdAt: '2026-11-04T10:00:00Z',
    updatedAt: '2026-11-04T10:00:00Z',
  },
  {
    id: 'note-old-plans',
    kind: 'note',
    title: 'Old plans',
    body: '',
    status: 'archived',
    createdAt: '2026-11-01T11:00:00Z',
    updatedAt: '2026-11-03T10:00:00Z',
  },
];

/** Test double answering synchronously from memory; set `failure` to make the next calls fail. */
export class FakeNotesGateway extends NotesGateway {
  failure: Error | undefined;
  notesToServe: readonly Note[] = SAMPLE_NOTES;
  readonly saved: { id: string; draft: NoteDraft }[] = [];
  readonly statusChanges: { id: string; status: NoteStatus }[] = [];
  readonly deleted: string[] = [];
  listCalls = 0;

  override list(): Observable<readonly Note[]> {
    this.listCalls += 1;
    return this.answer(this.notesToServe);
  }

  override save(id: string, draft: NoteDraft): Observable<Note> {
    this.saved.push({ id, draft });
    const note: Note = {
      id,
      ...draft,
      status: 'open',
      createdAt: SAVED_AT,
      updatedAt: SAVED_AT,
    };
    return this.answer(note);
  }

  override setStatus(id: string, status: NoteStatus): Observable<Note> {
    this.statusChanges.push({ id, status });
    const known = this.notesToServe.find((note) => note.id === id);
    const note: Note = known ?? {
      id,
      kind: 'note',
      title: id,
      body: '',
      status,
      createdAt: SAVED_AT,
      updatedAt: SAVED_AT,
    };
    return this.answer({ ...note, status });
  }

  override delete(id: string): Observable<void> {
    this.deleted.push(id);
    return this.answer(undefined);
  }

  private answer<TValue>(value: TValue): Observable<TValue> {
    return this.failure === undefined ? of(value) : throwError(() => this.failure);
  }
}
