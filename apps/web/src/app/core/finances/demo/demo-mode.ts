/** Where the choice of showing made-up Finances data is kept between visits. */
export const DEMO_STORAGE_KEY = 'budgeter.demo';

/**
 * Whether the Finances screens show made-up (demo) data instead of the person's own. Off unless it was
 * turned on, so real data is never hidden by surprise. Read once when the app starts, as the gateways it
 * picks are chosen then.
 * @example isDemoMode() // false
 */
export function isDemoMode(): boolean {
  try {
    return localStorage.getItem(DEMO_STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

/**
 * Turns the demo data on or off; the page has to start again for it to apply.
 * @example setDemoMode(true)
 */
export function setDemoMode(isOn: boolean): void {
  try {
    if (isOn) localStorage.setItem(DEMO_STORAGE_KEY, 'on');
    else localStorage.removeItem(DEMO_STORAGE_KEY);
  } catch {
    // Blocked storage only means the choice is not remembered.
  }
}

/**
 * Reads `?demo=on` or `?demo=off` from an address and applies it, so the demo can be switched from a link.
 * Answers whether the address asked for anything.
 * @example applyDemoFromAddress('?demo=on') // true
 */
export function applyDemoFromAddress(search: string): boolean {
  const asked = new URLSearchParams(search).get('demo');
  if (asked !== 'on' && asked !== 'off') return false;
  setDemoMode(asked === 'on');
  return true;
}
