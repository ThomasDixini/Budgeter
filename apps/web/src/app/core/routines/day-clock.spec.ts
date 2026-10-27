import {
  blockLength,
  blockMinutesWithin,
  blockPieces,
  clockDistance,
  dayPieces,
  hourMarks,
  isHappening,
  routineSpan,
} from './day-clock';
import { Routine, RoutineBlock } from './routine';
import { SAMPLE_ROUTINES } from './sample-routines';

const weekdays = SAMPLE_ROUTINES[0];
const FULL_DAY = { start: '00:00', end: '00:00' };
const SLEEP: RoutineBlock = { id: 'sleep', name: 'Sleep', start: '22:00', end: '06:00' };

describe('clockDistance', () => {
  it('measures forward within the same day', () => {
    expect(clockDistance(480, 1020)).toBe(540);
  });

  it('wraps past midnight', () => {
    expect(clockDistance(1320, 360)).toBe(480);
  });
});

describe('routineSpan', () => {
  it('measures a daytime routine', () => {
    expect(routineSpan({ start: '08:00', end: '17:00' })).toBe(540);
  });

  it('treats an end equal to the start as a full day', () => {
    expect(routineSpan(FULL_DAY)).toBe(1440);
  });

  it('runs a night routine past midnight', () => {
    expect(routineSpan({ start: '22:00', end: '06:00' })).toBe(480);
  });
});

describe('blockLength', () => {
  it('runs a block past midnight', () => {
    expect(blockLength(SLEEP)).toBe(480);
  });

  it('gives a block that ends when it starts no length', () => {
    expect(blockLength({ start: '12:00', end: '12:00' })).toBe(0);
  });
});

describe('blockPieces', () => {
  it('clips a block to the routine day', () => {
    const early = { id: 'gym', name: 'Gym', start: '07:00', end: '09:00' };

    expect(blockPieces(early, weekdays).map(({ start, end }) => ({ start, end }))).toEqual([
      { start: 0, end: 60 },
    ]);
  });

  it('leaves out a block outside the routine day', () => {
    expect(blockPieces(SLEEP, weekdays)).toEqual([]);
  });

  it('splits a block wrapping around a midnight-to-midnight day', () => {
    const pieces = blockPieces(SLEEP, FULL_DAY);

    expect(pieces.map(({ key, start, end }) => ({ key, start, end }))).toEqual([
      { key: 'sleep#0', start: 0, end: 360 },
      { key: 'sleep#1', start: 1320, end: 1440 },
    ]);
  });

  it('keeps a block whole on a day that starts when the block ends', () => {
    const fromWakeUp = { start: '06:00', end: '06:00' };

    expect(blockPieces(SLEEP, fromWakeUp).map(({ start, end }) => ({ start, end }))).toEqual([
      { start: 960, end: 1440 },
    ]);
  });
});

describe('blockMinutesWithin', () => {
  it('sums every piece of a wrapping block', () => {
    expect(blockMinutesWithin(SLEEP, FULL_DAY)).toBe(480);
  });
});

describe('dayPieces', () => {
  it('orders pieces by their position in the day', () => {
    const routine: Routine = { ...weekdays, ...FULL_DAY, blocks: [SLEEP, weekdays.blocks[0]] };

    expect(dayPieces(routine).map((piece) => piece.key)).toEqual(['sleep#0', 'work#0', 'sleep#1']);
  });
});

describe('isHappening', () => {
  it('finds a block that crossed midnight', () => {
    expect(isHappening(SLEEP, 2 * 60)).toBe(true);
  });

  it('ends a block at its end time', () => {
    expect(isHappening(SLEEP, 6 * 60)).toBe(false);
  });
});

describe('hourMarks', () => {
  it('starts at the first whole hour', () => {
    expect(hourMarks({ start: '23:30', end: '01:00' })).toEqual([
      { label: '00:00', offset: 30 },
      { label: '01:00', offset: 90 },
    ]);
  });

  it('aligns a coarser step to the clock', () => {
    const labels = hourMarks({ start: '07:00', end: '13:00' }, 3).map((mark) => mark.label);

    expect(labels).toEqual(['09:00', '12:00']);
  });
});
