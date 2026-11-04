import { SAMPLE_PORTFOLIO } from './fake-investments-gateway';
import { placeholderHistory } from './placeholder-history';

describe('placeholderHistory', () => {
  it('starts in the month of the first purchase and ends in the current one', () => {
    const history = placeholderHistory(SAMPLE_PORTFOLIO, '2026-11-03');

    expect([history[0].month, history[history.length - 1].month]).toEqual(['2026-10', '2026-11']);
  });

  it('keeps what was really applied', () => {
    const history = placeholderHistory(SAMPLE_PORTFOLIO, '2026-11-03');

    expect(history.map((point) => point.appliedCents)).toEqual([111000, 111000]);
  });

  it('gives the same points every time it is asked', () => {
    expect(placeholderHistory(SAMPLE_PORTFOLIO, '2026-11-03')).toEqual(
      placeholderHistory(SAMPLE_PORTFOLIO, '2026-11-03'),
    );
  });

  it('has nothing to draw before the first purchase', () => {
    expect(placeholderHistory({ ...SAMPLE_PORTFOLIO, trades: [] }, '2026-11-03')).toEqual([]);
  });
});
