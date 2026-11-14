import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Note } from '../../../../core/routines/notes';
import { NoteItem, NoteStatusChange } from './note-item';

function noteOf(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    kind: 'goal',
    title: 'Run a marathon',
    body: 'Train three times a week',
    status: 'open',
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-05T12:00:00Z',
    ...overrides,
  };
}

function render(note: Note): ComponentFixture<NoteItem> {
  const fixture = TestBed.createComponent(NoteItem);
  fixture.componentRef.setInput('note', note);
  fixture.detectChanges();
  return fixture;
}

function root(fixture: ComponentFixture<NoteItem>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function text(fixture: ComponentFixture<NoteItem>): string {
  return root(fixture).textContent?.replaceAll(/\s+/g, ' ') ?? '';
}

function button(fixture: ComponentFixture<NoteItem>, label: string): HTMLButtonElement | undefined {
  return [...root(fixture).querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent?.trim() === label,
  );
}

function clickButton(fixture: ComponentFixture<NoteItem>, label: string): void {
  button(fixture, label)!.click();
}

describe('NoteItem', () => {
  it('shows the kind label of a goal, a note and an idea', () => {
    const cases: readonly [Note['kind'], string][] = [
      ['goal', 'Goal'],
      ['note', 'Note'],
      ['idea', 'Idea'],
    ];

    for (const [kind, label] of cases) {
      const fixture = render(noteOf({ kind }));
      expect(root(fixture).querySelector('.kind')!.textContent!.trim()).toBe(label);
      expect(root(fixture).querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('shows the title and the last edited text', () => {
    const fixture = render(noteOf());

    expect(root(fixture).querySelector('h3')!.textContent).toContain('Run a marathon');
    expect(text(fixture)).toContain('Last edited');
  });

  it('shows the body as clamped literal text', () => {
    const fixture = render(noteOf({ body: '<b>x</b>' }));

    const body = root(fixture).querySelector('p.body')!;
    expect(body.textContent).toBe('<b>x</b>');
    expect(body.querySelector('b')).toBeNull();
    expect(getComputedStyle(body).whiteSpace).toBe('pre-line');
  });

  it('renders no body paragraph when the body is empty', () => {
    const fixture = render(noteOf({ body: '' }));

    expect(root(fixture).querySelector('.body')).toBeNull();
  });

  it('shows the done text and strikes the title through', () => {
    const fixture = render(noteOf({ status: 'done' }));

    expect(text(fixture)).toContain('Marked as done');
    expect(root(fixture).querySelector('h3')!.classList).toContain('struck');
  });

  it('does not strike an open title through', () => {
    const fixture = render(noteOf());

    expect(text(fixture)).not.toContain('Marked as done');
    expect(root(fixture).querySelector('h3')!.classList).not.toContain('struck');
  });

  it('hides the done toggle for notes and for archived items', () => {
    const note = render(noteOf({ kind: 'note' }));
    const archived = render(noteOf({ status: 'archived' }));

    expect(button(note, 'Mark as done')).toBeUndefined();
    expect(button(archived, 'Mark as done')).toBeUndefined();
    expect(button(archived, 'Reopen')).toBeUndefined();
  });

  it('emits done, then open from reopen', () => {
    const open = noteOf();
    const done = noteOf({ status: 'done' });
    const emitted: NoteStatusChange[] = [];

    const first = render(open);
    first.componentInstance.statusChange.subscribe((value) => emitted.push(value));
    clickButton(first, 'Mark as done');
    const second = render(done);
    second.componentInstance.statusChange.subscribe((value) => emitted.push(value));
    clickButton(second, 'Reopen');

    expect(emitted).toEqual([
      { note: open, status: 'done' },
      { note: done, status: 'open' },
    ]);
  });

  it('emits archived, then open from restore', () => {
    const open = noteOf();
    const archived = noteOf({ status: 'archived' });
    const emitted: NoteStatusChange[] = [];

    const first = render(open);
    first.componentInstance.statusChange.subscribe((value) => emitted.push(value));
    clickButton(first, 'Archive');
    const second = render(archived);
    second.componentInstance.statusChange.subscribe((value) => emitted.push(value));
    clickButton(second, 'Restore');

    expect(emitted).toEqual([
      { note: open, status: 'archived' },
      { note: archived, status: 'open' },
    ]);
  });

  it('emits edit and remove with the note', () => {
    const note = noteOf();
    const fixture = render(note);
    const edited: Note[] = [];
    const removed: Note[] = [];
    fixture.componentInstance.edit.subscribe((value) => edited.push(value));
    fixture.componentInstance.remove.subscribe((value) => removed.push(value));

    clickButton(fixture, 'Edit');
    clickButton(fixture, 'Delete');

    expect(edited).toEqual([note]);
    expect(removed).toEqual([note]);
  });

  it('puts the title in every action label', () => {
    const fixture = render(noteOf());

    const labels = [...root(fixture).querySelectorAll('button')].map((candidate) =>
      candidate.getAttribute('aria-label'),
    );
    expect(labels).toEqual([
      'Edit note Run a marathon',
      'Mark note Run a marathon as done',
      'Archive note Run a marathon',
      'Delete note Run a marathon',
    ]);
  });
});
