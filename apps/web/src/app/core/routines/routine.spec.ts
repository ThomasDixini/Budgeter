import {
  Routine,
  RoutineBlock,
  activeRoutine,
  hourTicks,
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
const SLEEP: RoutineBlock = { id: 'sleep', name: 'Sleep', start: '22:00', end: '06:00' };
const FULL_DAY: Routine = { ...weekdays, start: '00:00', end: '00:00', blocks: [] };

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

  it('flags a block that starts and ends at the same time', () => {
    const blocks = [{ id: 'x', name: 'Lunch', start: '12:00', end: '12:00' }];

    expect(scheduleIssues(blocks)).toEqual(['"Lunch" starts and ends at the same time']);
  });

  it('accepts a block that runs past midnight', () => {
    expect(scheduleIssues([SLEEP])).toEqual([]);
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

  // Regression: a block crossing midnight used to count as zero, so a full day never added up.
  it('fills a 24-hour day partitioned around a night of sleep', () => {
    const awake = { id: 'awake', name: 'Awake', start: '06:00', end: '22:00' };
    const routine: Routine = { ...FULL_DAY, blocks: [awake, SLEEP] };

    expect(plannedMinutes(routine)).toBe(24 * 60);
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

  it('labels a full day every 3 hours, ending at 24:00', () => {
    const ticks = hourTicks({ start: '00:00', end: '00:00' });

    expect(ticks.map((tick) => tick.label)).toEqual([
      '00:00',
      '03:00',
      '06:00',
      '09:00',
      '12:00',
      '15:00',
      '18:00',
      '21:00',
      '24:00',
    ]);
  });

  it('keeps hourly labels on a working day', () => {
    expect(hourTicks({ start: '08:00', end: '17:00' })).toHaveLength(10);
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

describe('activeRoutine', () => {
  const NIGHT_SHIFT: Routine = {
    id: 'night',
    name: 'Night shift',
    days: [0],
    start: '22:00',
    end: '06:00',
    blocks: [],
  };
  const TUESDAY = 1;
  const DAYTIME: Routine = { ...weekdays, days: [1, 2, 3, 4] };

  it('is the routine of the weekday during the day', () => {
    const active = activeRoutine([DAYTIME, NIGHT_SHIFT], TUESDAY, 14 * 60);

    expect(active).toEqual({ routine: DAYTIME, startedYesterday: false });
  });

  it("keeps last night's routine running until it ends", () => {
    const active = activeRoutine([DAYTIME, NIGHT_SHIFT], TUESDAY, 2 * 60);

    expect(active).toEqual({ routine: NIGHT_SHIFT, startedYesterday: true });
  });

  it("goes back to the weekday routine once last night's has ended", () => {
    const active = activeRoutine([DAYTIME, NIGHT_SHIFT], TUESDAY, 6 * 60);

    expect(active?.routine).toBe(DAYTIME);
  });

  it("ignores yesterday's routine when it ended before midnight", () => {
    expect(activeRoutine([DAYTIME], TUESDAY, 60)).toEqual({
      routine: DAYTIME,
      startedYesterday: false,
    });
  });

  it('is nothing when no routine covers the day', () => {
    expect(activeRoutine([DAYTIME], 5, 600)).toBeUndefined();
  });
});
