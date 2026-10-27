import { BlockOutcome, planDay } from './day-plan';
import { Routine } from './routine';

const EVENING: Routine = {
  id: 'evening',
  name: 'Evening',
  days: [0],
  start: '18:00',
  end: '23:00',
  blocks: [
    { id: 'gym', name: 'Gym', start: '18:00', end: '19:00' },
    { id: 'project', name: 'Side project', start: '20:00', end: '21:30' },
    { id: 'guitar', name: 'Guitar', start: '21:30', end: '22:15' },
    { id: 'read', name: 'Reading', start: '22:15', end: '23:00' },
  ],
};

function outcome(blockId: string, at: string, kind: 'done' | 'skipped' = 'done'): BlockOutcome {
  return { routineId: 'evening', blockId, outcome: kind, at };
}

function times(routine: Routine): string[] {
  return routine.blocks.map((block) => `${block.id} ${block.start}-${block.end}`);
}

describe('planDay', () => {
  it('leaves the day as planned without outcomes', () => {
    expect(planDay(EVENING, []).routine).toEqual(EVENING);
  });

  it('ends a block early and moves the rest of the day earlier by the time saved', () => {
    const { routine } = planDay(EVENING, [outcome('project', '20:40')]);

    expect(times(routine)).toEqual([
      'gym 18:00-19:00',
      'project 20:00-20:40',
      'guitar 20:40-21:25',
      'read 21:25-22:10',
    ]);
  });

  it('keeps blocks that came before the completed one in place', () => {
    const { routine } = planDay(EVENING, [outcome('guitar', '21:40')]);

    expect(times(routine).slice(0, 2)).toEqual(['gym 18:00-19:00', 'project 20:00-21:30']);
  });

  it('adds up the savings of several outcomes in the order they happened', () => {
    const { routine } = planDay(EVENING, [outcome('guitar', '20:50'), outcome('project', '20:40')]);

    expect(times(routine).slice(2)).toEqual(['guitar 20:40-20:50', 'read 20:50-21:35']);
  });

  it('remembers how each block ended', () => {
    const { outcomes } = planDay(EVENING, [outcome('project', '20:40', 'skipped')]);

    expect(outcomes.get('project')).toBe('skipped');
    expect(outcomes.has('gym')).toBe(false);
  });

  it('does not move overlapping blocks that were already running', () => {
    const withPodcast: Routine = {
      ...EVENING,
      blocks: [...EVENING.blocks, { id: 'podcast', name: 'Podcast', start: '20:30', end: '21:00' }],
    };

    const { routine } = planDay(withPodcast, [outcome('project', '20:40')]);

    expect(times(routine).at(-1)).toBe('podcast 20:30-21:00');
  });

  it('ignores outcomes of other routines and unknown blocks', () => {
    const others = [
      { ...outcome('project', '20:40'), routineId: 'weekend' },
      outcome('gone', '20:40'),
    ];

    expect(planDay(EVENING, others).routine).toEqual(EVENING);
  });

  it('works across midnight', () => {
    const night: Routine = {
      ...EVENING,
      start: '22:00',
      end: '06:00',
      blocks: [
        { id: 'shift', name: 'Shift', start: '22:00', end: '02:00' },
        { id: 'rest', name: 'Rest', start: '02:00', end: '06:00' },
      ],
    };

    const { routine } = planDay(night, [{ ...outcome('shift', '01:30'), routineId: 'evening' }]);

    expect(times(routine)).toEqual(['shift 22:00-01:30', 'rest 01:30-05:30']);
  });
});
