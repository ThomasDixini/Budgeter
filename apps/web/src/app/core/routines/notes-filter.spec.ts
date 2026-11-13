import { filterNotes, matchesQuery, NoteFilter } from './notes-filter';
import { Note } from './notes';

function note(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n1',
    kind: 'note',
    title: 'Title',
    body: '',
    status: 'open',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const OPEN_ALL: NoteFilter = { kind: 'all', status: 'open', query: '' };

describe('filterNotes', () => {
  it('keeps every kind when the kind is all', () => {
    const notes = [note({ id: 'a', kind: 'goal' }), note({ id: 'b', kind: 'idea' })];

    const result = filterNotes(notes, OPEN_ALL);

    expect(result.map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('keeps only the chosen kind', () => {
    const notes = [note({ id: 'a', kind: 'goal' }), note({ id: 'b', kind: 'idea' })];

    const result = filterNotes(notes, { ...OPEN_ALL, kind: 'idea' });

    expect(result.map((n) => n.id)).toEqual(['b']);
  });

  it('always applies the status, hiding done and archived on an open filter', () => {
    const notes = [
      note({ id: 'a', status: 'open' }),
      note({ id: 'b', status: 'done' }),
      note({ id: 'c', status: 'archived' }),
    ];

    const result = filterNotes(notes, OPEN_ALL);

    expect(result.map((n) => n.id)).toEqual(['a']);
  });

  it('combines kind, status and query', () => {
    const notes = [
      note({ id: 'a', kind: 'idea', title: 'Cambly' }),
      note({ id: 'b', kind: 'goal', title: 'Cambly' }),
      note({ id: 'c', kind: 'idea', title: 'Cambly', status: 'done' }),
      note({ id: 'd', kind: 'idea', title: 'Other' }),
    ];

    const result = filterNotes(notes, { kind: 'idea', status: 'open', query: 'cambly' });

    expect(result.map((n) => n.id)).toEqual(['a']);
  });

  it('preserves the input order', () => {
    const notes = [note({ id: 'z' }), note({ id: 'a' }), note({ id: 'm' })];

    const result = filterNotes(notes, OPEN_ALL);

    expect(result.map((n) => n.id)).toEqual(['z', 'a', 'm']);
  });

  it('returns an empty list for an empty list', () => {
    expect(filterNotes([], OPEN_ALL)).toEqual([]);
  });
});

describe('matchesQuery', () => {
  it('matches the title', () => {
    expect(matchesQuery(note({ title: 'Learn Cambly' }), 'learn')).toBe(true);
  });

  it('matches the body', () => {
    expect(matchesQuery(note({ body: 'book a lesson' }), 'lesson')).toBe(true);
  });

  it('ignores case', () => {
    expect(matchesQuery(note({ title: 'Cambly' }), 'CAMBLY')).toBe(true);
  });

  it('ignores accents on the note', () => {
    expect(matchesQuery(note({ title: 'Ação' }), 'acao')).toBe(true);
  });

  it('ignores accents on the query', () => {
    expect(matchesQuery(note({ title: 'cafe' }), 'café')).toBe(true);
  });

  it('matches everything for a blank query', () => {
    expect(matchesQuery(note(), '')).toBe(true);
  });

  it('matches everything for a whitespace-only query', () => {
    expect(matchesQuery(note(), '   ')).toBe(true);
  });

  it('trims the query before matching', () => {
    expect(matchesQuery(note({ title: 'Cambly' }), '  cambly  ')).toBe(true);
  });

  it('searches only the title when the body is empty', () => {
    expect(matchesQuery(note({ title: 'Cambly', body: '' }), 'xyz')).toBe(false);
  });

  it('does not match text absent from title and body', () => {
    expect(matchesQuery(note({ title: 'Cambly', body: 'lesson' }), 'gym')).toBe(false);
  });

  it('matches regex characters literally', () => {
    expect(matchesQuery(note({ title: 'abc' }), 'a.c')).toBe(false);
    expect(matchesQuery(note({ title: 'a.c' }), 'a.c')).toBe(true);
    expect(matchesQuery(note({ title: 'a(b)*' }), '(b)*')).toBe(true);
  });
});
