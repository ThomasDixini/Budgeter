import { ErrorHandler, Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { IdGenerator } from '../ids/id-generator';
import { NOTE_TITLE_MAX, Note, NoteDraft, NoteStatus } from './notes';
import { NotesGateway } from './notes-gateway';

/** Newest update first; ISO timestamps compare correctly as strings, ties fall back to the id. */
function sorted(notes: readonly Note[]): readonly Note[] {
  return [...notes].sort(
    (a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id),
  );
}

/**
 * The notes on the Notes page. Provided by the page: it reads the list when created. Not optimistic,
 * because the timestamps are decided by the API; the screen follows its answers.
 */
@Injectable()
export class NotesStore {
  private readonly gateway = inject(NotesGateway);
  private readonly ids = inject(IdGenerator);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly noteList = signal<readonly Note[]>([]);
  private readonly loaded = signal(false);
  private readonly loadFailed = signal(false);
  private readonly actionFailed = signal(false);
  private readonly saves = signal(0);
  /** Counts list requests, so an answer overtaken by a newer one is dropped. */
  private listRequest = 0;

  readonly notes = this.noteList.asReadonly();
  readonly isLoaded = this.loaded.asReadonly();
  readonly hasLoadFailed = this.loadFailed.asReadonly();
  readonly hasActionFailed = this.actionFailed.asReadonly();
  /** How many saves the API has accepted; a form waits for it to grow to know its save went through. */
  readonly savedCount = this.saves.asReadonly();

  constructor() {
    this.load();
  }

  /**
   * Loads again after a failed load.
   * @example store.reload()
   */
  reload(): void {
    this.loadFailed.set(false);
    this.load();
  }

  /**
   * Creates a note (a new id is generated when none is given) or replaces the one with that id.
   * @example store.save({ kind: 'goal', title: 'Read more', body: '' })
   */
  save(draft: NoteDraft, id?: string): void {
    const noteId = id ?? this.ids.next();
    this.change(this.gateway.save(noteId, draft), (note) => {
      this.upsert(note);
      this.saves.update((count) => count + 1);
    });
  }

  /**
   * Jots down an idea from its title; blank text does nothing.
   * @example store.addIdea('Call Ana')
   */
  addIdea(title: string): void {
    const clean = title.trim();
    if (clean === '') return;
    this.save({ kind: 'idea', title: clean.slice(0, NOTE_TITLE_MAX), body: '' });
  }

  /**
   * Moves a note to another status.
   * @example store.setStatus('note-cambly', 'archived')
   */
  setStatus(id: string, status: NoteStatus): void {
    this.change(this.gateway.setStatus(id, status), (note) => this.upsert(note));
  }

  /**
   * Deletes a note.
   * @example store.remove('note-cambly')
   */
  remove(id: string): void {
    this.change(this.gateway.delete(id), () =>
      this.noteList.update((notes) => notes.filter((note) => note.id !== id)),
    );
  }

  private change<TAnswer>(
    request: Observable<TAnswer>,
    onAccepted: (answer: TAnswer) => void,
  ): void {
    this.actionFailed.set(false);
    request.subscribe({
      next: onAccepted,
      error: (error: unknown) => this.failAction(error),
    });
  }

  private upsert(note: Note): void {
    this.noteList.update((notes) =>
      sorted([...notes.filter((known) => known.id !== note.id), note]),
    );
  }

  private failAction(error: unknown): void {
    this.actionFailed.set(true);
    this.errorHandler.handleError(error);
  }

  private load(): void {
    const request = ++this.listRequest;
    this.gateway.list().subscribe({
      next: (notes) => {
        if (request !== this.listRequest) return;
        this.noteList.set(sorted(notes));
        this.loaded.set(true);
      },
      error: (error: unknown) => {
        if (request !== this.listRequest) return;
        this.loadFailed.set(true);
        this.errorHandler.handleError(error);
      },
    });
  }
}
