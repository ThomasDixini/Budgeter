import { SESSION_STORAGE_KEY } from './core/auth/session-store';

/*
 * Regression test: specs share one jsdom, and a session left in the storage by one test made the
 * "starts with no one signed in" spec of SessionStore fail depending on the order the runner picked.
 * The tests run in order: the first leaves data behind, the second must not find it.
 */
describe('browser storage between tests', () => {
  it('lets a test leave a session and a setting behind', () => {
    localStorage.setItem(SESSION_STORAGE_KEY, 'left behind');
    sessionStorage.setItem(SESSION_STORAGE_KEY, 'left behind');
    localStorage.setItem('some.setting', 'on');

    expect(localStorage.length + sessionStorage.length).toBe(3);
  });

  it('starts the next test with empty storage', () => {
    expect([localStorage.length, sessionStorage.length]).toEqual([0, 0]);
  });
});
