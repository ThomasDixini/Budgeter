import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Note, NoteDraft } from '../../../../core/routines/notes';
import { NoteForm } from './note-form';

interface Saved {
  id: string | null;
  draft: NoteDraft;
}

interface Rendered {
  fixture: ComponentFixture<NoteForm>;
  saved: Saved[];
  cancelled: number[];
}

function noteOf(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    kind: 'goal',
    title: 'Run a 10k',
    body: 'Train three times a week',
    status: 'open',
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-02T10:00:00Z',
    ...overrides,
  };
}

function render(note: Note | null = null): Rendered {
  const fixture = TestBed.createComponent(NoteForm);
  fixture.componentRef.setInput('note', note);
  const saved: Saved[] = [];
  const cancelled: number[] = [];
  fixture.componentInstance.saved.subscribe((value) => saved.push(value));
  fixture.componentInstance.cancelled.subscribe(() => cancelled.push(1));
  fixture.detectChanges();
  return { fixture, saved, cancelled };
}

function root(fixture: ComponentFixture<NoteForm>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function field<T extends HTMLElement>(fixture: ComponentFixture<NoteForm>, name: string): T {
  const found = root(fixture).querySelector<T>(`[name="${name}"]`);
  if (found === null) throw new Error(`Expected a field named "${name}" in the form`);
  return found;
}

function type(fixture: ComponentFixture<NoteForm>, name: string, value: string): void {
  const input = field<HTMLInputElement | HTMLTextAreaElement>(fixture, name);
  input.value = value;
  input.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

function choose(fixture: ComponentFixture<NoteForm>, value: string): void {
  const select = field<HTMLSelectElement>(fixture, 'kind');
  select.value = value;
  select.dispatchEvent(new Event('change'));
  fixture.detectChanges();
}

function optionValues(fixture: ComponentFixture<NoteForm>): string[] {
  const options = field<HTMLSelectElement>(fixture, 'kind').options;
  return Array.from(options).map((option) => option.value);
}

function saveButton(fixture: ComponentFixture<NoteForm>): HTMLButtonElement {
  return root(fixture).querySelector<HTMLButtonElement>('button[type="submit"]')!;
}

function submit(fixture: ComponentFixture<NoteForm>): void {
  root(fixture)
    .querySelector('form')!
    .dispatchEvent(new SubmitEvent('submit', { cancelable: true }));
  fixture.detectChanges();
}

function counterText(fixture: ComponentFixture<NoteForm>): string {
  return root(fixture).querySelector('.counter')!.textContent!.trim();
}

describe('NoteForm', () => {
  it('shows the new heading and an Idea default when there is no note', () => {
    const { fixture } = render();

    expect(root(fixture).querySelector('h3')!.textContent).toContain('New note');
    expect(field<HTMLSelectElement>(fixture, 'kind').value).toBe('idea');
    expect(field<HTMLInputElement>(fixture, 'title').value).toBe('');
  });

  it('shows the edit heading and prefills the note', () => {
    const { fixture } = render(noteOf());

    expect(root(fixture).querySelector('h3')!.textContent).toContain('Edit note');
    expect(field<HTMLSelectElement>(fixture, 'kind').value).toBe('goal');
    expect(field<HTMLInputElement>(fixture, 'title').value).toBe('Run a 10k');
    expect(field<HTMLTextAreaElement>(fixture, 'body').value).toBe('Train three times a week');
  });

  it('offers every kind for an open note and no Note kind for a done one', () => {
    const open = render(noteOf());
    const done = render(noteOf({ status: 'done' }));

    expect(optionValues(open.fixture)).toEqual(['goal', 'note', 'idea']);
    expect(optionValues(done.fixture)).toEqual(['goal', 'idea']);
  });

  it('emits a new note with a null id, trimmed title and untouched body', () => {
    const { fixture, saved } = render();

    type(fixture, 'title', '  Read more  ');
    type(fixture, 'body', '\nfirst line 🎉\nsecond  ');
    submit(fixture);

    expect(saved).toEqual([
      { id: null, draft: { kind: 'idea', title: 'Read more', body: '\nfirst line 🎉\nsecond  ' } },
    ]);
  });

  it('emits an edit with the note id and the changed kind', () => {
    const { fixture, saved } = render(noteOf());

    choose(fixture, 'note');
    type(fixture, 'title', 'Run a 5k');
    submit(fixture);

    expect(saved).toEqual([
      {
        id: 'note-1',
        draft: { kind: 'note', title: 'Run a 5k', body: 'Train three times a week' },
      },
    ]);
  });

  it('allows an empty body', () => {
    const { fixture, saved } = render();

    type(fixture, 'title', 'Only a title');
    submit(fixture);

    expect(saved[0].draft.body).toBe('');
  });

  it('blocks a blank or whitespace title', () => {
    const { fixture, saved } = render();

    type(fixture, 'title', '   ');
    submit(fixture);

    expect(saveButton(fixture).disabled).toBe(true);
    expect(saved).toEqual([]);
  });

  it('blocks values longer than the limits', () => {
    const { fixture, saved } = render();

    type(fixture, 'title', 'a'.repeat(81));
    submit(fixture);
    type(fixture, 'title', 'ok');
    type(fixture, 'body', 'b'.repeat(4001));
    submit(fixture);

    expect(saved).toEqual([]);
  });

  it('limits the fields with maxlength', () => {
    const { fixture } = render();

    expect(field<HTMLInputElement>(fixture, 'title').maxLength).toBe(80);
    expect(field<HTMLTextAreaElement>(fixture, 'body').maxLength).toBe(4000);
  });

  it('shows the character counter only from 3500 characters', () => {
    const { fixture } = render();

    type(fixture, 'body', 'a'.repeat(3499));
    expect(counterText(fixture)).toBe('');
    type(fixture, 'body', 'a'.repeat(3500));

    expect(counterText(fixture)).toBe('3500 / 4000 characters');
    expect(root(fixture).querySelector('.counter')!.getAttribute('aria-live')).toBe('polite');
  });

  it('emits cancelled from the Cancel button and from Escape', () => {
    const { fixture, cancelled } = render();
    const cancel = root(fixture).querySelector<HTMLButtonElement>('button[type="button"]')!;

    cancel.click();
    root(fixture)
      .querySelector('form')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(cancelled).toHaveLength(2);
  });
});
