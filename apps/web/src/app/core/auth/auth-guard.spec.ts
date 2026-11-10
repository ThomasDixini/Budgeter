import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { DEMO_STORAGE_KEY } from '../finances/demo/demo-mode';
import { authGuard } from './auth-guard';
import { fakeSession } from './fake-auth-gateway';
import { SessionStore } from './session-store';

function runGuard(): unknown {
  return TestBed.runInInjectionContext(() =>
    authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  );
}

describe('authGuard', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  afterEach(() => {
    TestBed.inject(SessionStore).end();
    localStorage.removeItem(DEMO_STORAGE_KEY);
  });

  it('lets a signed-in person through', () => {
    TestBed.inject(SessionStore).start(fakeSession(), false);

    expect(runGuard()).toBe(true);
  });

  it('sends anyone else to the sign-in screen', () => {
    const result = runGuard();

    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login');
  });

  it('lets the demo in without an account, as it shows made-up data from the browser alone', () => {
    localStorage.setItem(DEMO_STORAGE_KEY, 'on');

    expect(runGuard()).toBe(true);
  });
});
