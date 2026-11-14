import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Clock } from '../../calendar/clock';
import { Note, NoteDraft, NoteKind, NoteStatus } from '../notes';
import { NotesGateway } from '../notes-gateway';

const MILLISECONDS_PER_DAY = 86_400_000;

interface SeedNote {
  readonly id: string;
  readonly kind: NoteKind;
  readonly title: string;
  readonly body: string;
  readonly status: NoteStatus;
  readonly createdDaysAgo: number;
  readonly updatedDaysAgo: number;
}

const SEED_NOTES: readonly SeedNote[] = [
  {
    id: 'demo-note-comfort-zone',
    kind: 'goal',
    title: 'Leave the comfort zone',
    body: 'Say yes to one thing that scares me each week.\nStart a conversation with a stranger.\nReview how it felt on Sundays.',
    status: 'open',
    createdDaysAgo: 20,
    updatedDaysAgo: 1,
  },
  {
    id: 'demo-note-cambly',
    kind: 'note',
    title: 'Cambly',
    body: 'Practice English twice a week with a tutor, one lesson on Tuesday and another on Friday.',
    status: 'open',
    createdDaysAgo: 15,
    updatedDaysAgo: 3,
  },
  {
    id: 'demo-note-sales-script',
    kind: 'idea',
    title: 'Sales call script',
    body: '',
    status: 'open',
    createdDaysAgo: 9,
    updatedDaysAgo: 5,
  },
  {
    id: 'demo-note-cold-shower',
    kind: 'idea',
    title: 'Try a cold shower week',
    body: '',
    status: 'done',
    createdDaysAgo: 12,
    updatedDaysAgo: 7,
  },
  {
    id: 'demo-note-reading-list',
    kind: 'note',
    title: 'Old reading list',
    body: '',
    status: 'archived',
    createdDaysAgo: 40,
    updatedDaysAgo: 30,
  },
];

function daysBefore(now: Date, days: number): string {
  return new Date(now.getTime() - days * MILLISECONDS_PER_DAY).toISOString();
}

function seedNotes(now: Date): Note[] {
  return SEED_NOTES.map(({ createdDaysAgo, updatedDaysAgo, ...fields }) => ({
    ...fields,
    createdAt: daysBefore(now, createdDaysAgo),
    updatedAt: daysBefore(now, updatedDaysAgo),
  }));
}

function byUpdatedThenId(first: Note, second: Note): number {
  return second.updatedAt.localeCompare(first.updatedAt) || first.id.localeCompare(second.id);
}

/** Notes kept in memory by the demo, dated from the demo clock; nothing is sent anywhere. */
@Injectable()
export class DemoNotesGateway extends NotesGateway {
  private readonly clock = inject(Clock);
  private notes: Note[] = seedNotes(this.clock.now());

  override list(): Observable<readonly Note[]> {
    return of([...this.notes].sort(byUpdatedThenId));
  }

  override save(id: string, draft: NoteDraft): Observable<Note> {
    const now = this.clock.now().toISOString();
    const existing = this.notes.find((note) => note.id === id);
    const stored: Note = existing
      ? { ...existing, ...draft, updatedAt: now }
      : { id, ...draft, status: 'open', createdAt: now, updatedAt: now };
    this.replace(stored);
    return of(stored);
  }

  override setStatus(id: string, status: NoteStatus): Observable<Note> {
    const existing = this.notes.find((note) => note.id === id);
    if (existing === undefined) throw new Error(`Unknown note "${id}", expected an existing id`);
    // The API rejects a done note; the demo only keeps it from crashing.
    if (status === 'done' && existing.kind === 'note') return of(existing);
    const stored: Note = { ...existing, status, updatedAt: this.clock.now().toISOString() };
    this.replace(stored);
    return of(stored);
  }

  override delete(id: string): Observable<void> {
    this.notes = this.notes.filter((note) => note.id !== id);
    return of(undefined);
  }

  private replace(stored: Note): void {
    this.notes = [...this.notes.filter((note) => note.id !== stored.id), stored];
  }
}
