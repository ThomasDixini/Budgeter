import {
  appendBlock,
  newRoutine,
  partitionLaneCount,
  partitionSegments,
  removeBlock,
  toggleDay,
  updateBlock,
} from './routine-edits';
import { RoutineBlock } from './routine';
import { SAMPLE_ROUTINES } from './sample-routines';

const weekdays = SAMPLE_ROUTINES[0];
/** Runs during work on purpose. */
const PODCAST: RoutineBlock = { id: 'podcast', name: 'Podcast', start: '09:00', end: '10:00' };

describe('newRoutine', () => {
  it('starts blank and on no weekday, so it never takes over another routine’s day', () => {
    expect(newRoutine('r1')).toEqual({
      id: 'r1',
      name: 'New routine',
      days: [],
      start: '08:00',
      end: '17:00',
      blocks: [],
    });
  });
});

describe('toggleDay', () => {
  it('adds a missing weekday', () => {
    expect(toggleDay(weekdays, 5).days).toContain(5);
  });

  it('removes a present weekday', () => {
    expect(toggleDay(weekdays, 0).days).not.toContain(0);
  });
});

describe('updateBlock', () => {
  it('changes only the targeted block', () => {
    const edited = updateBlock(weekdays, 'lunch', { end: '14:00' });

    expect(edited.blocks.map((block) => block.end)).toEqual(['12:00', '14:00', '15:00', '17:00']);
  });
});

describe('removeBlock', () => {
  it('drops the block', () => {
    expect(removeBlock(weekdays, 'lunch').blocks.map((block) => block.id)).toEqual([
      'work',
      'csharp',
      'network',
    ]);
  });
});

describe('appendBlock', () => {
  it('adds a one-hour block after the latest one', () => {
    const block = appendBlock(weekdays, 'new').blocks.at(-1);

    expect(block).toEqual({ id: 'new', name: 'New block', start: '17:00', end: '18:00' });
  });
});

describe('partitionSegments', () => {
  it('places blocks as percentages of the day', () => {
    const [work] = partitionSegments(weekdays);

    expect(work.left).toBe(0);
    expect(work.width).toBeCloseTo(44.44, 1);
  });

  it('leaves out blocks outside the day', () => {
    const shortDay = { ...weekdays, end: '12:00' };

    expect(partitionSegments(shortDay).map((segment) => segment.block.id)).toEqual(['work']);
  });

  it('fills the bar height when a block overlaps nothing', () => {
    const [work] = partitionSegments(weekdays);

    expect({ top: work.top, height: work.height }).toEqual({ top: 0, height: 100 });
  });

  it('stacks overlapping blocks in half-height lanes', () => {
    const segments = partitionSegments({ ...weekdays, blocks: [...weekdays.blocks, PODCAST] });
    const podcast = segments.find((segment) => segment.block.id === 'podcast');

    expect({ top: podcast?.top, height: podcast?.height }).toEqual({ top: 50, height: 50 });
  });

  it('draws a block wrapping around a full day at both ends of the bar', () => {
    const sleep = { id: 'sleep', name: 'Sleep', start: '22:00', end: '06:00' };
    const fullDay = { ...weekdays, start: '00:00', end: '00:00', blocks: [sleep] };

    const segments = partitionSegments(fullDay).map(({ key, left, width }) => ({
      key,
      left,
      width,
    }));

    expect(segments).toEqual([
      { key: 'sleep#0', left: 0, width: 25 },
      { key: 'sleep#1', left: (22 / 24) * 100, width: (2 / 24) * 100 },
    ]);
  });
});

describe('appendBlock on a full day', () => {
  it('wraps the new block past midnight', () => {
    const late = { id: 'late', name: 'Late', start: '20:00', end: '23:30' };
    const fullDay = { ...weekdays, start: '00:00', end: '00:00', blocks: [late] };

    expect(appendBlock(fullDay, 'new').blocks.at(-1)).toMatchObject({
      start: '23:30',
      end: '00:30',
    });
  });
});

describe('partitionLaneCount', () => {
  it('grows with overlapping blocks inside the day', () => {
    expect(partitionLaneCount({ ...weekdays, blocks: [...weekdays.blocks, PODCAST] })).toBe(2);
  });

  it('ignores overlaps outside the day', () => {
    const evening = { id: 'e1', name: 'Evening', start: '18:00', end: '19:00' };
    const overlap = { id: 'e2', name: 'Overlap', start: '18:30', end: '19:30' };

    expect(partitionLaneCount({ ...weekdays, blocks: [evening, overlap] })).toBe(1);
  });
});
