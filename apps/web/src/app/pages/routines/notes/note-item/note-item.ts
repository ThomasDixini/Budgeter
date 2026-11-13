import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { isoDate, shortDateLabel } from '../../../../core/calendar/date-label';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { Note, NoteKind, NoteStatus } from '../../../../core/routines/notes';

/** What a status change request carries: the note and the status it should move to. */
export interface NoteStatusChange {
  readonly note: Note;
  readonly status: NoteStatus;
}

const KIND_LABELS: Readonly<Record<NoteKind, string>> = {
  goal: 'Goal',
  note: 'Note',
  idea: 'Idea',
};

/**
 * One row of the Notes list: kind, title, clamped body and the actions on the note.
 * Presentational only; the page owns the data and applies the events.
 *
 * @example <app-note-item [note]="note" (edit)="open($event)" (statusChange)="move($event)" (remove)="ask($event)" />
 */
@Component({
  selector: 'app-note-item',
  imports: [TranslatePipe],
  templateUrl: './note-item.html',
  styleUrl: './note-item.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoteItem {
  readonly note = input.required<Note>();
  readonly edit = output<Note>();
  readonly statusChange = output<NoteStatusChange>();
  readonly remove = output<Note>();

  private readonly locale = inject(LOCALE_ID);

  protected readonly kindLabel = computed(() => KIND_LABELS[this.note().kind]);
  protected readonly canToggleDone = computed(
    () => this.note().kind !== 'note' && this.note().status !== 'archived',
  );
  protected readonly editedDate = computed(() =>
    shortDateLabel(isoDate(new Date(this.note().updatedAt)), this.locale),
  );

  protected toggleDone(): void {
    const { status } = this.note();
    this.changeStatus(status === 'done' ? 'open' : 'done');
  }

  protected toggleArchive(): void {
    const { status } = this.note();
    this.changeStatus(status === 'archived' ? 'open' : 'archived');
  }

  private changeStatus(status: NoteStatus): void {
    this.statusChange.emit({ note: this.note(), status });
  }
}
