import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { LoadFailed } from '../../../components/load-failed/load-failed';
import { PageHeading } from '../../../components/page-heading/page-heading';
import { fieldValue } from '../../../core/forms/field-value';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Note, NoteDraft, NoteKind, NoteStatus } from '../../../core/routines/notes';
import { filterNotes } from '../../../core/routines/notes-filter';
import { NotesStore } from '../../../core/routines/notes-store';
import { NoteForm } from './note-form/note-form';
import { NoteItem, NoteStatusChange } from './note-item/note-item';

/** The form open below the list, if any. */
type NotesPanel = { readonly kind: 'new' } | { readonly kind: 'edit'; readonly note: Note } | null;

interface KindChip {
  readonly value: NoteKind | 'all';
  readonly label: string;
}

interface StatusChip {
  readonly value: NoteStatus;
  readonly label: string;
}

/**
 * Personal notes: goals, notes and ideas, with a quick idea field, filters by kind and status, and a
 * search. The form stays open until the API accepts the save, so a failure never loses the text.
 */
@Component({
  selector: 'app-notes',
  imports: [TranslatePipe, PageHeading, LoadFailed, NoteItem, NoteForm],
  providers: [NotesStore],
  templateUrl: './notes.html',
  styleUrl: './notes.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Notes {
  protected readonly store = inject(NotesStore);
  /** The saves accepted when a save was sent; the form closes once the count grows past it. */
  private readonly savesAtSend = signal<number | null>(null);

  protected readonly kindChips: readonly KindChip[] = [
    { value: 'all', label: 'All notes' },
    { value: 'goal', label: 'Goals' },
    { value: 'note', label: 'Notes' },
    { value: 'idea', label: 'Ideas' },
  ];
  protected readonly statusChips: readonly StatusChip[] = [
    { value: 'open', label: 'Open notes' },
    { value: 'done', label: 'Done notes' },
    { value: 'archived', label: 'Archived notes' },
  ];

  protected readonly kind = signal<NoteKind | 'all'>('all');
  protected readonly status = signal<NoteStatus>('open');
  protected readonly query = signal('');
  protected readonly quickIdea = signal('');
  protected readonly panel = signal<NotesPanel>(null);

  protected readonly visible = computed(() =>
    filterNotes(this.store.notes(), {
      kind: this.kind(),
      status: this.status(),
      query: this.query(),
    }),
  );
  protected readonly hasFilters = computed(
    () => this.kind() !== 'all' || this.status() !== 'open' || this.query().trim() !== '',
  );
  protected readonly editedNote = computed(() => {
    const panel = this.panel();
    return panel?.kind === 'edit' ? panel.note : null;
  });

  protected readonly valueOf = fieldValue;

  constructor() {
    effect(() => this.closeFormAfterSave());
  }

  /**
   * Adds the quick idea field's text as an idea and clears the field; blank text does nothing.
   * @example this.addIdea()
   */
  protected addIdea(): void {
    if (this.quickIdea().trim() === '') return;
    this.store.addIdea(this.quickIdea());
    this.quickIdea.set('');
  }

  protected setKind(kind: NoteKind | 'all'): void {
    this.kind.set(kind);
  }

  protected setStatus(status: NoteStatus): void {
    this.status.set(status);
  }

  protected clearFilters(): void {
    this.kind.set('all');
    this.status.set('open');
    this.query.set('');
  }

  protected openForm(panel: NotesPanel): void {
    this.savesAtSend.set(null);
    this.panel.set(panel);
  }

  /**
   * Sends the form's note. The form stays open until the API accepts it.
   * @example this.saveNote({ id: null, draft: { kind: 'idea', title: 'Podcast', body: '' } })
   */
  protected saveNote(saved: { id: string | null; draft: NoteDraft }): void {
    this.savesAtSend.set(this.store.savedCount());
    this.store.save(saved.draft, saved.id ?? undefined);
  }

  protected changeStatus(change: NoteStatusChange): void {
    this.store.setStatus(change.note.id, change.status);
  }

  protected removeNote(note: Note): void {
    this.store.remove(note.id);
  }

  private closeFormAfterSave(): void {
    const awaited = this.savesAtSend();
    if (awaited === null || this.store.savedCount() === awaited) return;
    untracked(() => this.openForm(null));
  }
}
