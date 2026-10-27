import {
  blockElapsed,
  currentBlock,
  dayProgress,
  minutesLeft,
  nowLineOffset,
  timelineBlocks,
  timelineHeight,
  timelineHours,
} from './day-timeline';
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
