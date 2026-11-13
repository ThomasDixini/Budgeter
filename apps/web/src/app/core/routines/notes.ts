/** What a note is for: a goal to reach, a free-form note or an idea to explore. */
export type NoteKind = 'goal' | 'note' | 'idea';

/** Where a note stands; only goals and ideas can be `done`. */
export type NoteStatus = 'open' | 'done' | 'archived';

/** A free-text note as the API stores it; timestamps are UTC ISO-8601 set by the API. */
export interface Note {
  readonly id: string;
  readonly kind: NoteKind;
  readonly title: string;
  readonly body: string;
  readonly status: NoteStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** What the user writes when creating or editing a note. */
export interface NoteDraft {
  readonly kind: NoteKind;
  readonly title: string;
  readonly body: string;
}

/** Longest title the API accepts, in characters. */
export const NOTE_TITLE_MAX = 80;

/** Longest body the API accepts, in characters. */
export const NOTE_BODY_MAX = 4000;
