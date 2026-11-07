import { moduleMove } from './module-transition';

describe('module move', () => {
  it('slides forward when going further along home, Routines, Finances', () => {
    expect([moduleMove('', 'routines'), moduleMove('routines', 'finances')]).toEqual([
      'forward',
      'forward',
    ]);
  });

  it('slides back when going the other way', () => {
    expect([moduleMove('finances', 'routines'), moduleMove('routines', '')]).toEqual([
      'backward',
      'backward',
    ]);
  });

  it('does not animate inside the same module or to an address that is no module', () => {
    expect([moduleMove('finances', 'finances'), moduleMove('finances', 'nowhere')]).toEqual([
      undefined,
      undefined,
    ]);
  });
});
