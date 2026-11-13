import { Note, NoteKind, NoteStatus } from './notes';

/** Which notes the Notes page shows: one kind (or all) in one status, narrowed by a text search. */
export interface NoteFilter {
  readonly kind: NoteKind | 'all';
  readonly status: NoteStatus;
  readonly query: string;
}

/**
 * Keeps the notes that match every part of the filter, in their input order.
 * @example filterNotes(notes, { kind: 'idea', status: 'open', query: 'cafe' })
 */
export function filterNotes(notes: readonly Note[], filter: NoteFilter): readonly Note[] {
  return notes.filter((note) => passesFilter(note, filter));
}

/**
 * True when the title or body contains the query, ignoring case and accents; a blank query matches all.
 * @example matchesQuery(note, 'acao') // true for a note titled "Ação"
 */
export function matchesQuery(note: Note, query: string): boolean {
  const needle = fold(query.trim());
  if (needle === '') return true;
  return fold(note.title).includes(needle) || fold(note.body).includes(needle);
}

function passesFilter(note: Note, filter: NoteFilter): boolean {
  if (filter.kind !== 'all' && note.kind !== filter.kind) return false;
  if (note.status !== filter.status) return false;
  return matchesQuery(note, filter.query);
}

/** Lower-cases and strips accents so "Ação" and "acao" compare equal. */
function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
}
