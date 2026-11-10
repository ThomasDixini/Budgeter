import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { authInterceptor } from './auth-interceptor';
import { fakeSession } from './fake-auth-gateway';
import { SessionStore } from './session-store';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let sessions: SessionStore;
  let navigation: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    sessions = TestBed.inject(SessionStore);
    navigation = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => {
    backend.verify();
    sessions.end();
  });

  it('sends the token of the session with every call to the API', () => {
    sessions.start(fakeSession('Ana'), false);

    http.get('/api/goals').subscribe();
    const call = backend.expectOne('/api/goals');
    call.flush([]);

    expect(call.request.headers.get('Authorization')).toBe('Bearer token-of-Ana');
  });

  it('sends nothing when no one is signed in', () => {
    http.get('/api/goals').subscribe();
    const call = backend.expectOne('/api/goals');
    call.flush([]);

    expect(call.request.headers.has('Authorization')).toBe(false);
  });

  it('keeps the token away from the sign-in calls and from other sites', () => {
    sessions.start(fakeSession('Ana'), false);

    http.post('/api/auth/login', {}).subscribe();
    http.get('https://example.com/data').subscribe();
    const login = backend.expectOne('/api/auth/login');
    const other = backend.expectOne('https://example.com/data');
    login.flush({});
    other.flush({});

    expect([
      login.request.headers.has('Authorization'),
      other.request.headers.has('Authorization'),
    ]).toEqual([false, false]);
  });

  it('signs out and goes to the sign-in when the API stops accepting the token', () => {
    sessions.start(fakeSession('Ana'), false);

    http.get('/api/goals').subscribe({ error: () => undefined });
    backend.expectOne('/api/goals').flush('', { status: 401, statusText: 'Unauthorized' });

    expect(sessions.isSignedIn()).toBe(false);
    expect(navigation).toHaveBeenCalledWith('/login');
  });

  it('leaves other failures alone', () => {
    sessions.start(fakeSession('Ana'), false);

    http.get('/api/goals').subscribe({ error: () => undefined });
    backend.expectOne('/api/goals').flush('', { status: 500, statusText: 'Server Error' });

    expect(sessions.isSignedIn()).toBe(true);
    expect(navigation).not.toHaveBeenCalled();
  });

  it('does not treat a wrong password as an expired session', () => {
    sessions.start(fakeSession('Ana'), false);

    http.post('/api/auth/login', {}).subscribe({ error: () => undefined });
    backend.expectOne('/api/auth/login').flush('', { status: 401, statusText: 'Unauthorized' });

    expect(sessions.isSignedIn()).toBe(true);
  });
});
