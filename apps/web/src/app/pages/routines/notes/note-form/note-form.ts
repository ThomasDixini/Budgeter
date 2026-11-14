import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { fieldValue } from '../../../../core/forms/field-value';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import {
  NOTE_BODY_MAX,
  NOTE_TITLE_MAX,
  Note,
  NoteDraft,
  NoteKind,
} from '../../../../core/routines/notes';

/** Characters from which the live counter is shown. */
const COUNTER_THRESHOLD = 3500;
const BODY_ROWS = 6;

interface KindOption {
  readonly value: NoteKind;
  readonly label: string;
}

const KIND_OPTIONS: readonly KindOption[] = [
  { value: 'goal', label: 'Goal' },
  { value: 'note', label: 'Note' },
  { value: 'idea', label: 'Idea' },
];

/**
 * Inline form to create or edit a note (goal, note or idea). Presentational: emits the draft.
 * @example <app-note-form [note]="null" (saved)="store.save($event.draft, $event.id ?? undefined)" />
 */
@Component({
  selector: 'app-note-form',
  imports: [TranslatePipe],
  templateUrl: './note-form.html',
  styleUrl: './note-form.css',
})
export class NoteForm {
  /** The note being edited; `null` when creating one. */
  readonly note = input<Note | null>(null);
  /** `id` is the edited note's id, `null` for a new note. */
  readonly saved = output<{ id: string | null; draft: NoteDraft }>();
  readonly cancelled = output();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterNextRender(() =>
      this.host.nativeElement.querySelector<HTMLInputElement>('input[name="title"]')?.focus(),
    );
  }

  protected readonly maxTitleLength = NOTE_TITLE_MAX;
  protected readonly maxBodyLength = NOTE_BODY_MAX;
  protected readonly bodyRows = BODY_ROWS;
  protected readonly isEditing = computed(() => this.note() !== null);
  protected readonly kindOptions = computed(() =>
    // The API rejects the "note" kind on a done note.
    this.note()?.status === 'done'
      ? KIND_OPTIONS.filter((option) => option.value !== 'note')
      : KIND_OPTIONS,
  );

  protected readonly kind = linkedSignal<NoteKind>(() => this.note()?.kind ?? 'idea');
  protected readonly title = linkedSignal(() => this.note()?.title ?? '');
  protected readonly body = linkedSignal(() => this.note()?.body ?? '');

  protected readonly bodyLength = computed(() => this.body().length);
  protected readonly isCounterVisible = computed(() => this.bodyLength() >= COUNTER_THRESHOLD);
  protected readonly canSave = computed(
    () =>
      this.title().trim() !== '' &&
      this.title().length <= NOTE_TITLE_MAX &&
      this.bodyLength() <= NOTE_BODY_MAX,
  );

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    if (!this.canSave()) return;
    this.saved.emit({
      id: this.note()?.id ?? null,
      draft: { kind: this.kind(), title: this.title().trim(), body: this.body() },
    });
  }

  protected chooseKind(value: string): void {
    const option = this.kindOptions().find((candidate) => candidate.value === value);
    if (option !== undefined) this.kind.set(option.value);
  }

  protected readonly valueOf = fieldValue;
}
