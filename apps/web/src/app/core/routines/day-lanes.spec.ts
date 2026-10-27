import { DayPiece } from './day-clock';
import { maxLanes, pieceLanes } from './day-lanes';

/** A piece named after its block, at offsets in minutes from the start of the day. */
function piece(name: string, start: number, end: number): DayPiece {
  return { block: { id: name, name, start: '00:00', end: '00:00' }, key: name, start, end };
}

const WORK = piece('work', 0, 240);
/** Runs during work on purpose. */
const PODCAST = piece('podcast', 60, 120);

describe('pieceLanes', () => {
  it('gives a piece that overlaps nothing the whole width', () => {
    expect(pieceLanes([WORK, piece('lunch', 240, 300)]).get('lunch')).toEqual({
      lane: 0,
      lanes: 1,
    });
  });

  it('puts overlapping pieces in separate lanes', () => {
    const lanes = pieceLanes([PODCAST, WORK]);

    expect(lanes.get('work')).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get('podcast')).toEqual({ lane: 1, lanes: 2 });
  });

  it('reuses a lane once its piece has ended', () => {
    const emails = piece('emails', 120, 180);

    expect(pieceLanes([WORK, PODCAST, emails]).get('emails')).toEqual({ lane: 1, lanes: 2 });
  });
});

describe('maxLanes', () => {
  it('is one when nothing overlaps', () => {
    expect(maxLanes([WORK])).toBe(1);
  });

  it('is one with no pieces at all', () => {
    expect(maxLanes([])).toBe(1);
  });

  it('counts the lanes of the busiest overlap', () => {
    expect(maxLanes([WORK, PODCAST])).toBe(2);
  });
});
