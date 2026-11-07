import { DEMO_STORAGE_KEY, applyDemoFromAddress, isDemoMode, setDemoMode } from './demo-mode';

describe('demo mode', () => {
  afterEach(() => localStorage.removeItem(DEMO_STORAGE_KEY));

  it('is off until it is turned on, and off again once turned off', () => {
    const initial = isDemoMode();
    setDemoMode(true);
    const on = isDemoMode();
    setDemoMode(false);

    expect([initial, on, isDemoMode()]).toEqual([false, true, false]);
  });

  it('can be switched from an address, and ignores any other value', () => {
    const asked = [applyDemoFromAddress('?demo=on'), isDemoMode()];
    const nothing = [applyDemoFromAddress('?demo=maybe'), applyDemoFromAddress(''), isDemoMode()];
    const off = [applyDemoFromAddress('?x=1&demo=off'), isDemoMode()];

    expect([asked, nothing, off]).toEqual([
      [true, true],
      [false, false, true],
      [true, false],
    ]);
  });
});
