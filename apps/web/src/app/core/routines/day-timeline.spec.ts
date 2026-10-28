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

  it('gives a block that overlaps nothing the full width', () => {
    const lunch = timelineBlocks(weekdays, STUDY_TIME)[1];

    expect({ left: lunch.left, width: lunch.width }).toEqual({ left: 0, width: 100 });
  });

  it('places overlapping blocks side by side', () => {
    const podcast = { id: 'podcast', name: 'Podcast', start: '09:00', end: '10:00' };
    const routine = { ...weekdays, blocks: [...weekdays.blocks, podcast] };

    const placed = timelineBlocks(routine, STUDY_TIME).find((item) => item.block.id === 'podcast');

    expect({ left: placed?.left, width: placed?.width }).toEqual({ left: 50, width: 50 });
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
  it('keeps ended blocks one line tall by growing upward, ending where they ended', () => {
    const { guitar, read } = placed(STUDY_TIME);

    expect(guitar).toEqual({ top: 266, height: 24 }); // 13:33 – 14:03
    expect(read).toEqual({ top: 266, height: 24 });
  });

  it('never draws an ended block past the "now" line', () => {
    const now = 14 * 60 + 1; // 14:01, the end is clamped to the line
    const { guitar } = placed(now);

    expect(guitar.top + guitar.height).toBe(nowLineOffset(ended, now));
  });

  it('draws ended blocks at their planned length when the day is not running', () => {
    const evening = 20 * 60; // after the 08:00–17:00 day: no "now" line
    const { guitar, read } = placed(evening);

    expect(guitar).toEqual({ top: 288, height: 48 }); // 14:00 for an hour
    expect(read).toEqual({ top: 290, height: 36 }); // 14:03 for 45 minutes
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
