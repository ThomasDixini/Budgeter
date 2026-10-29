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
    expect(stretch.stackShift).toBe(30);
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

    expect(stretch.stackShift).toBe(20);
    expect(stretch.at(30)).toBe(50);
  });

  it('ignores pending blocks that are still ahead', () => {
    const stretch = stretchForStack([piece(150, 200)], [piece(70, 100)], NOW);

    expect(stretch).toBe(NO_STRETCH);
  });
});
