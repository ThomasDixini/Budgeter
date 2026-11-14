import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { Clock } from '../../calendar/clock';
import { FixedClock } from '../../calendar/fixed-clock';
import { DemoNotesGateway } from './demo-notes';

function setup(now: Date): DemoNotesGateway {
  TestBed.configureTestingModule({
    providers: [{ provide: Clock, useValue: new FixedClock(now) }, DemoNotesGateway],
  });
  return TestBed.inject(DemoNotesGateway);
}

const NOW = new Date(Date.UTC(2026, 10, 13, 12, 0));

describe('demo notes gateway', () => {
  it('lists the five seeded notes, most recently updated first', async () => {
    const gateway = setup(NOW);

    const notes = await firstValueFrom(gateway.list());

    expect(notes.map((note) => [note.title, note.kind, note.status])).toEqual([
      ['Leave the comfort zone', 'goal', 'open'],
      ['Cambly', 'note', 'open'],
      ['Sales call script', 'idea', 'open'],
      ['Try a cold shower week', 'idea', 'done'],
      ['Old reading list', 'note', 'archived'],
    ]);
  });

  it('dates the seeded notes from the demo clock', async () => {
    const gateway = setup(new Date(Date.UTC(2030, 5, 15, 12, 0)));

    const notes = await firstValueFrom(gateway.list());

    expect(notes[0].updatedAt).toBe('2030-06-14T12:00:00.000Z');
    expect(notes.every((note) => note.createdAt.startsWith('2030-0'))).toBe(true);
  });

  it('creates a note as open dated now', async () => {
    const gateway = setup(NOW);

    const note = await firstValueFrom(gateway.save('n1', { kind: 'idea', title: 'T', body: '' }));

    const notes = await firstValueFrom(gateway.list());
    expect(note).toEqual({
      id: 'n1',
      kind: 'idea',
      title: 'T',
      body: '',
      status: 'open',
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
    expect(notes[0].id).toBe('n1');
  });

  it('edits a note keeping its creation date and status and moving the update date', async () => {
    const gateway = setup(NOW);
    const before = (await firstValueFrom(gateway.list())).find((n) => n.title === 'Cambly');

    const edited = await firstValueFrom(
      gateway.save('demo-note-cambly', { kind: 'note', title: 'Cambly 2', body: 'x' }),
    );

    expect(edited.title).toBe('Cambly 2');
    expect(edited.createdAt).toBe(before?.createdAt);
    expect(edited.status).toBe('open');
    expect(edited.updatedAt).toBe(NOW.toISOString());
  });

  it('changes the status and the update date', async () => {
    const gateway = setup(NOW);

    const note = await firstValueFrom(gateway.setStatus('demo-note-sales-script', 'done'));

    expect(note.status).toBe('done');
    expect(note.updatedAt).toBe(NOW.toISOString());
  });

  it('ignores marking a plain note as done', async () => {
    const gateway = setup(NOW);

    const note = await firstValueFrom(gateway.setStatus('demo-note-cambly', 'done'));

    expect(note.status).toBe('open');
  });

  it('deletes a note', async () => {
    const gateway = setup(NOW);

    await firstValueFrom(gateway.delete('demo-note-cambly'));

    const notes = await firstValueFrom(gateway.list());
    expect(notes.map((note) => note.id)).not.toContain('demo-note-cambly');
  });
});
