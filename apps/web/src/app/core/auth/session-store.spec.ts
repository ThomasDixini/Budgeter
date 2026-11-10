import { TestBed } from '@angular/core/testing';
import { fakeSession } from './fake-auth-gateway';
import { SESSION_STORAGE_KEY, SessionStore } from './session-store';

function createStore(): SessionStore {
  TestBed.resetTestingModule();
  return TestBed.inject(SessionStore);
}

describe('SessionStore', () => {
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('starts with no one signed in', () => {
    const store = createStore();

    expect([store.isSignedIn(), store.token(), store.user()]).toEqual([false, null, null]);
  });

  it('offers the token and the person once a session starts', () => {
    const store = createStore();

    store.start(fakeSession('Ana'), false);

    expect([store.isSignedIn(), store.token(), store.user()?.name]).toEqual([
      true,
      'token-of-Ana',
      'Ana',
    ]);
  });

  it('keeps a remembered session in localStorage, so it survives a restart', () => {
    createStore().start(fakeSession('Ana'), true);

    expect(createStore().token()).toBe('token-of-Ana');
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('keeps any other session in sessionStorage only', () => {
    createStore().start(fakeSession('Ana'), false);

    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(createStore().token()).toBe('token-of-Ana');
  });

  it('forgets the session everywhere when it ends', () => {
    const store = createStore();
    store.start(fakeSession('Ana'), true);

    store.end();

    expect([store.isSignedIn(), localStorage.getItem(SESSION_STORAGE_KEY)]).toEqual([false, null]);
  });

  it('replaces the previous session, not adds to it', () => {
    const store = createStore();
    store.start(fakeSession('Ana'), true);

    store.start(fakeSession('Bia'), false);

    expect([store.user()?.name, localStorage.getItem(SESSION_STORAGE_KEY)]).toEqual(['Bia', null]);
  });

  it('drops a stored session that has expired instead of offering it', () => {
    const expired = { ...fakeSession('Ana'), expiresAt: new Date(Date.now() - 1000).toISOString() };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(expired));

    const store = createStore();

    expect([store.isSignedIn(), localStorage.getItem(SESSION_STORAGE_KEY)]).toEqual([false, null]);
  });

  it('signs out when the token runs out while the page is open', () => {
    const store = createStore();
    store.start(
      { ...fakeSession('Ana'), expiresAt: new Date(Date.now() - 1).toISOString() },
      false,
    );

    expect([store.token(), store.isSignedIn()]).toEqual([null, false]);
  });

  it('ignores a stored value that is not a session', () => {
    localStorage.setItem(SESSION_STORAGE_KEY, 'not json');

    expect(createStore().isSignedIn()).toBe(false);
  });
});
