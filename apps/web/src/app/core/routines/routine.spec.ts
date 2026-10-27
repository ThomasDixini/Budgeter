import {
  Routine,
  RoutineBlock,
  blockLanes,
  hourTicks,
  maxLanes,
  plannedMinutes,
  routineForWeekday,
  scheduleIssues,
  sortBlocks,
  weekdaysLabel,
  weeklyMinutesByCategory,
} from './routine';
import { SAMPLE_ROUTINES } from './sample-routines';

const weekdays = SAMPLE_ROUTINES[0];
const WORK: RoutineBlock = { id: 'work', name: 'Work', start: '08:00', end: '12:00' };
/** Runs during work on purpose. */
const PODCAST: RoutineBlock = { id: 'podcast', name: 'Podcast', start: '09:00', end: '10:00' };

describe('sortBlocks', () => {
  it('orders blocks by start time', () => {
    const shuffled = [...weekdays.blocks].reverse();

    expect(sortBlocks(shuffled)[0].name).toBe('Work');
  });
});

describe('scheduleIssues', () => {
  it('finds nothing in a clean routine', () => {
    expect(scheduleIssues(weekdays.blocks)).toEqual([]);
  });

  it('flags a block that ends before it starts', () => {
    const blocks = [{ id: 'x', name: 'Lunch', start: '13:00', end: '12:00' }];

    expect(scheduleIssues(blocks)).toEqual(['"Lunch" ends before it starts']);
  });

  it('accepts overlapping blocks, which can run side by side on purpose', () => {
    expect(scheduleIssues([WORK, PODCAST])).toEqual([]);
  });
});

describe('plannedMinutes', () => {
  it('sums the time covered by blocks', () => {
    expect(plannedMinutes(weekdays)).toBe(540);
  });

  it('ignores the part of a block outside the day', () => {
    const routine: Routine = { ...weekdays, end: '16:00' };

    expect(plannedMinutes(routine)).toBe(480);
  });

  it('counts overlapping time once', () => {
    const routine: Routine = { ...weekdays, blocks: [WORK, PODCAST] };

    expect(plannedMinutes(routine)).toBe(240);
  });
});

describe('blockLanes', () => {
  it('gives a block that overlaps nothing the whole width', () => {
    expect(blockLanes(weekdays.blocks).get('lunch')).toEqual({ lane: 0, lanes: 1 });
  });

  it('puts overlapping blocks in separate lanes', () => {
    const lanes = blockLanes([PODCAST, WORK]);

    expect(lanes.get('work')).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get('podcast')).toEqual({ lane: 1, lanes: 2 });
  });

  it('reuses a lane once its block has ended', () => {
    const afterPodcast = { id: 'emails', name: 'Emails', start: '10:00', end: '11:00' };

    expect(blockLanes([WORK, PODCAST, afterPodcast]).get('emails')).toEqual({ lane: 1, lanes: 2 });
  });

  it('keeps blocks that only touch in one lane', () => {
    const lunch = { id: 'lunch', name: 'Lunch', start: '12:00', end: '13:00' };

    expect(blockLanes([WORK, lunch]).get('lunch')).toEqual({ lane: 0, lanes: 1 });
  });
});

describe('maxLanes', () => {
  it('is one when nothing overlaps', () => {
    expect(maxLanes(weekdays.blocks)).toBe(1);
  });

  it('counts the lanes of the busiest overlap', () => {
    expect(maxLanes([...weekdays.blocks, PODCAST])).toBe(2);
  });
});

describe('weeklyMinutesByCategory', () => {
  it('multiplies daily minutes by the number of days', () => {
    expect(weeklyMinutesByCategory(weekdays).get('study')).toBe(450);
  });

  it('skips blocks without category', () => {
    expect([...weeklyMinutesByCategory(weekdays).keys()]).toEqual(['study', 'networking']);
  });
});

describe('hourTicks', () => {
  it('places one tick per hour along the day', () => {
    expect(hourTicks({ start: '08:00', end: '10:00' })).toEqual([
      { label: '08:00', offset: 0 },
      { label: '09:00', offset: 50 },
      { label: '10:00', offset: 100 },
    ]);
  });
});

describe('weekdaysLabel', () => {
  it('shows a contiguous run as a range', () => {
    expect(weekdaysLabel([0, 1, 2, 3, 4])).toBe('Mon–Fri');
  });

  it('lists scattered days', () => {
    expect(weekdaysLabel([4, 0])).toBe('Mon, Fri');
  });

  it('names a routine without days', () => {
    expect(weekdaysLabel([])).toBe('No days');
  });
});

describe('routineForWeekday', () => {
  it('finds the routine that runs on the weekday', () => {
    expect(routineForWeekday(SAMPLE_ROUTINES, 5)?.name).toBe('Weekend');
  });
});
