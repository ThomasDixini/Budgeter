import { DayPiece } from './day-clock';
import { RoutineBlock } from './routine';
import { NO_STRETCH, stretchForStack } from './timeline-stretch';

const BLOCK: RoutineBlock = { id: 'x', name: 'X', start: '00:00', end: '00:00' };

function piece(start: number, end: number): DayPiece {
  return { block: BLOCK, key: `${start}-${end}`, start, end };
}

const NOW = 100;

describe('stretchForStack', () => {
  it('keeps the timeline as it is when the stack fits above the last pending block', () => {
    const stretch = stretchForStack([piece(0, 40)], [piece(70, 100)], NOW);

    expect(stretch).toBe(NO_STRETCH);
  });

  it('spreads the time between the last pending block and "now" to fit the stack', () => {
    // Pending block ends at 40; the stack needs 90 minutes above "now" but only 60 are free.
    const stretch = stretchForStack([piece(0, 40)], [piece(10, 100)], NOW);

    expect(stretch.at(40)).toBe(40);
    expect(stretch.at(70)).toBe(85);
    expect(stretch.at(NOW)).toBe(130);
    expect(stretch.placeEnded({ start: 10, end: 100 })).toEqual({ start: 40, end: 130 });
  });

  it('moves everything after "now" down by the room it made', () => {
    const stretch = stretchForStack([piece(0, 40)], [piece(10, 100)], NOW);

    expect(stretch.at(160)).toBe(190);
  });

  it('leaves the part of the day before the last pending block in place', () => {
    const stretch = stretchForStack([piece(0, 40)], [piece(10, 100)], NOW);

    expect(stretch.at(20)).toBe(20);
  });

  it('makes room at the top of the day when the stack would climb past it', () => {
    const stretch = stretchForStack([], [piece(-20, 30)], 30);

    expect(stretch.placeEnded({ start: -20, end: 30 })).toEqual({ start: 0, end: 50 });
    expect(stretch.at(30)).toBe(50);
  });

  it('ignores pending blocks that are still ahead', () => {
    const stretch = stretchForStack([piece(150, 200)], [piece(70, 100)], NOW);

    expect(stretch).toBe(NO_STRETCH);
  });

  // Regression: a past block completed later sat far above "now", and the whole gap between it and
  // "now" was counted as stack, stretching the running block across the screen.
  it('leaves out a block ended in its own slot, away from the now line', () => {
    const stretch = stretchForStack([piece(0, 40)], [piece(5, 15)], NOW);

    expect(stretch).toBe(NO_STRETCH);
    expect(stretch.placeEnded({ start: 5, end: 15 })).toEqual({ start: 5, end: 15 });
  });

  it('stretches for the blocks against now only, and keeps an earlier ended block in place', () => {
    const stretch = stretchForStack([piece(0, 40)], [piece(0, 5), piece(10, 100)], NOW);

    expect(stretch.placeEnded({ start: 10, end: 100 })).toEqual({ start: 40, end: 130 });
    expect(stretch.placeEnded({ start: 0, end: 5 })).toEqual({ start: 0, end: 5 });
  });
});
