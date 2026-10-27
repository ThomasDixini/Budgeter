import {
  appendBlock,
  partitionSegments,
  removeBlock,
  toggleDay,
  updateBlock,
} from './routine-edits';
import { SAMPLE_ROUTINES } from './sample-routines';

const weekdays = SAMPLE_ROUTINES[0];

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
});
