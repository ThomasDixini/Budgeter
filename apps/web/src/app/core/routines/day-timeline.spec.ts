import {
  blockElapsed,
  currentBlock,
  dayProgress,
  isCompactBlock,
  minutesLeft,
  nowLineOffset,
  timelineBlocks,
  timelineHeight,
  timelineHours,
  timelineLayout,
} from './day-timeline';
import { Routine } from './routine';
import { SAMPLE_ROUTINES } from './sample-routines';

const weekdays = SAMPLE_ROUTINES[0];
/** 14:10, during the C# study block. */
const STUDY_TIME = 850;

describe('timeline geometry', () => {
  it('is 48 pixels per hour', () => {
    expect(timelineHeight(weekdays)).toBe(432);
  });

  it('draws one gridline per hour', () => {
    expect(timelineHours(weekdays)).toHaveLength(10);
  });

  it('positions blocks by their start time', () => {
    const lunch = timelineBlocks(weekdays, STUDY_TIME)[1];

    expect({ top: lunch.top, height: lunch.height }).toEqual({ top: 192, height: 72 });
  });

  it('flags only the block happening now', () => {
    const now = timelineBlocks(weekdays, STUDY_TIME).filter((item) => item.isNow);

    expect(now.map((item) => item.block.name)).toEqual(['C# study']);
  });

  it('places an overlapping block at its own time, beside the block it overlaps', () => {
    const podcast = { id: 'podcast', name: 'Podcast', start: '09:00', end: '10:00' };
    const routine = { ...weekdays, blocks: [...weekdays.blocks, podcast] };

    const blocks = timelineBlocks(routine, STUDY_TIME);
    const placed = (id: string) => blocks.find((item) => item.block.id === id);

    expect(placed('podcast')).toMatchObject({ top: 48, height: 48, left: 50, width: 50 });
    expect(placed('work')).toMatchObject({ left: 0, width: 50 });
  });

  it('keeps blocks that overlap nothing at full width', () => {
    const lunch = timelineBlocks(weekdays, STUDY_TIME).find((item) => item.block.id === 'lunch');

    expect(lunch).toMatchObject({ left: 0, width: 100 });
  });
});

describe('timelineBlocks with ended blocks', () => {
  const ended: Routine = {
    ...weekdays,
    blocks: [
      { id: 'guitar', name: 'Guitar', start: '14:00', end: '14:03' },
      { id: 'read', name: 'Reading', start: '14:03', end: '14:03' },
      { id: 'next', name: 'Next', start: '14:03', end: '15:00' },
    ],
  };

  /** Guitar was planned for an hour and Reading for 45 minutes before they ended early. */
  const PLANNED = new Map([
    ['guitar', 60],
    ['read', 45],
  ]);

  function placed(nowMinutes: number): Record<string, { top: number; height: number }> {
    return Object.fromEntries(
      timelineBlocks(ended, nowMinutes, PLANNED).map((item) => [
        item.block.id,
        { top: item.top, height: item.height },
      ]),
    );
  }

  // Regression: a block completed minutes (or seconds) after it started shrank to nothing.
  it('puts short ended blocks in one line, side by side, oldest on the left', () => {
    const { guitar, read } = placed(STUDY_TIME);

    expect(read).toEqual({ top: 266, height: 24 }); // 13:33 – 14:03
    expect(guitar).toEqual({ top: 266, height: 24 });
    const columns = timelineBlocks(ended, STUDY_TIME, PLANNED).map(
      ({ block, left, width }) => [block.id, left, width] as const,
    );
    expect(columns).toContainEqual(['guitar', 0, 50]);
    expect(columns).toContainEqual(['read', 50, 50]);
  });

  it('stacks short ended blocks beyond a full row upward, one line per row', () => {
    const four: Routine = {
      ...weekdays,
      blocks: ['a', 'b', 'c', 'd', 'e'].map((id) => ({
        id,
        name: id,
        start: '14:03',
        end: '14:03',
      })),
    };
    const endedInOrder = new Map(['a', 'b', 'c', 'd', 'e'].map((id) => [id, 0]));

    const tops = timelineBlocks(four, STUDY_TIME, endedInOrder).map((item) => item.top);

    expect([...new Set(tops)].sort((first, second) => first - second)).toEqual([242, 266]);
  });

  it('keeps a long ended block on a row of its own', () => {
    const long: Routine = {
      ...weekdays,
      blocks: [{ id: 'work', name: 'Work', start: '12:00', end: '14:00' }],
    };

    const [work] = timelineBlocks(long, STUDY_TIME, new Map([['work', 120]]));

    expect({ left: work.left, width: work.width }).toEqual({ left: 0, width: 100 });
  });

  it('puts the block ended last lowest when two ended at the same minute', () => {
    const sameMinute: Routine = {
      ...weekdays,
      blocks: [
        { id: 'a', name: 'A', start: '14:03', end: '14:03' },
        { id: 'b', name: 'B', start: '14:03', end: '14:03' },
      ],
    };
    const endedInOrder = new Map([
      ['b', 0],
      ['a', 0],
    ]);

    const [upper, lower] = timelineBlocks(sameMinute, STUDY_TIME, endedInOrder);

    expect([upper.block.id, lower.block.id]).toEqual(['b', 'a']);
  });

  it('never draws an ended block past the "now" line', () => {
    const now = 14 * 60 + 1; // 14:01, before both recorded ends: they are clamped to the line
    const { guitar, read } = placed(now);
    const bottoms = [guitar, read].map((row) => row.top + row.height);

    expect(Math.max(...bottoms)).toBe(nowLineOffset(ended, now));
  });

  it('draws ended blocks at their planned length, one after the other, when the day is over', () => {
    const evening = 20 * 60; // after the 08:00–17:00 day: no "now" line
    const { guitar, read } = placed(evening);

    expect(guitar).toEqual({ top: 288, height: 48 }); // 14:00 for an hour
    expect(read).toEqual({ top: 336, height: 36 }); // right below, for 45 minutes
  });

  it('does not keep a zero-length block that has not ended', () => {
    expect(timelineBlocks(ended, STUDY_TIME).map((item) => item.block.id)).not.toContain('read');
  });
});

describe('isCompactBlock', () => {
  it('draws a 30-minute block on one line', () => {
    expect(isCompactBlock(24)).toBe(true);
  });

  it('keeps the two-line layout from about 80 minutes up', () => {
    expect(isCompactBlock(64)).toBe(false);
  });
});

describe('nowLineOffset', () => {
  it('places the line at the current minute', () => {
    expect(nowLineOffset(weekdays, STUDY_TIME)).toBe(296);
  });

  it('hides the line outside the routine day', () => {
    expect(nowLineOffset(weekdays, 20 * 60)).toBeUndefined();
  });
});

describe('day progress', () => {
  it('measures how much of the day has passed', () => {
    expect(dayProgress(weekdays, STUDY_TIME)).toBe(69);
  });

  it('stays at 100 after the day ends', () => {
    expect(dayProgress(weekdays, 22 * 60)).toBe(100);
  });
});

describe('current block', () => {
  it('finds the block running now', () => {
    expect(currentBlock(weekdays, STUDY_TIME)?.name).toBe('C# study');
  });

  it('measures elapsed time and minutes left', () => {
    const block = { start: '13:30', end: '15:00' };

    expect([blockElapsed(block, STUDY_TIME), minutesLeft(block, STUDY_TIME)]).toEqual([44, 50]);
  });
});

// Regression: completing several blocks in a row stacked them over a block still pending (Gym).
describe('timelineLayout making room for ended blocks', () => {
  const evening: Routine = {
    id: 'evening',
    name: 'Evening',
    days: [0],
    start: '18:00',
    end: '23:00',
    blocks: [
      { id: 'gym', name: 'Gym', start: '18:00', end: '19:00' },
      { id: 'hello', name: 'Hello world', start: '19:00', end: '19:42' },
      { id: 'side', name: 'Side project', start: '19:42', end: '19:42' },
      { id: 'guitar', name: 'Guitar', start: '19:42', end: '19:42' },
      { id: 'reading', name: 'Reading', start: '19:42', end: '20:27' },
    ],
  };
  const NOW = 19 * 60 + 42;
  const ENDED = new Map([
    ['hello', 60],
    ['side', 90],
    ['guitar', 45],
  ]);

  function blockById(id: string): { top: number; height: number } {
    const found = timelineLayout(evening, NOW, ENDED).blocks.find((item) => item.block.id === id);
    if (found === undefined) throw new Error(`Expected block "${id}" on the timeline, found none`);
    return found;
  }

  it('keeps every ended block below the pending block before it', () => {
    const gym = blockById('gym');
    const gymBottom = gym.top + gym.height;

    for (const id of ['hello', 'side', 'guitar']) {
      expect(blockById(id).top).toBeGreaterThanOrEqual(gymBottom);
    }
  });

  it('puts the "now" line right under the stack and the running block right after it', () => {
    const layout = timelineLayout(evening, NOW, ENDED);
    const side = blockById('side');

    expect(layout.nowOffset).toBe(side.top + side.height);
    expect(blockById('reading').top).toBe(layout.nowOffset);
  });

  it('spreads the hours before "now" and grows the timeline by the same room', () => {
    const plain = timelineLayout(evening, NOW);
    const stretched = timelineLayout(evening, NOW, ENDED);
    const hourTop = (label: string): number | undefined =>
      stretched.hours.find((hour) => hour.label === label)?.top;

    expect(hourTop('19:00')).toBe(48);
    expect(hourTop('20:00')).toBeGreaterThan(96);
    expect(stretched.height).toBeGreaterThan(plain.height);
  });

  it('leaves the layout untouched when the stack fits', () => {
    // Hello world ran 19:00–19:42, right after Gym: it fills its own time and needs no room.
    const fits = new Map([['hello', 60]]);

    expect(timelineLayout(evening, NOW, fits).height).toBe(timelineLayout(evening, NOW).height);
  });
});

// Regression: completing a past block (Morning run) at 19:30 moved it up to "now" and stretched the
// running block over the whole gap. It must stay in its own slot, only marked done.
describe('timelineLayout with a past block completed later', () => {
  const day: Routine = {
    id: 'weekdays',
    name: 'Weekdays',
    days: [0],
    start: '06:00',
    end: '23:00',
    blocks: [
      { id: 'run', name: 'Morning run', start: '06:00', end: '06:30' },
      { id: 'gym', name: 'Gym', start: '18:00', end: '19:00' },
      { id: 'hello', name: 'Hello world practice', start: '19:00', end: '20:00' },
    ],
  };
  const NOW = 19 * 60 + 30;
  const RUN_DONE = new Map([['run', 30]]);

  function placed(id: string): { top: number; height: number } {
    const found = timelineLayout(day, NOW, RUN_DONE).blocks.find((item) => item.block.id === id);
    if (found === undefined) throw new Error(`Expected block "${id}" on the timeline, found none`);
    return { top: found.top, height: found.height };
  }

  it('keeps the completed block where it was planned', () => {
    expect(placed('run')).toEqual({ top: 0, height: 24 });
  });

  it('leaves every other block and the timeline as they were', () => {
    const plain = timelineLayout(day, NOW);

    expect(placed('hello')).toEqual({ top: 624, height: 48 });
    expect(timelineLayout(day, NOW, RUN_DONE).height).toBe(plain.height);
    expect(timelineLayout(day, NOW, RUN_DONE).nowOffset).toBe(plain.nowOffset);
  });
});
