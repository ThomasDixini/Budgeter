import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthFailure, AuthFailureReason } from './auth-gateway';
import { fakeSession } from './fake-auth-gateway';
import { HttpAuthGateway } from './http-auth-gateway';

describe('HttpAuthGateway', () => {
  let gateway: HttpAuthGateway;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), HttpAuthGateway],
    });
    gateway = TestBed.inject(HttpAuthGateway);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('posts the credentials to /api/auth/login and returns the session', () => {
    let received;
    const session = fakeSession('Ana');
    const request = { email: 'ana@mail.com', password: 'secret', remember: true };

    gateway.signIn(request).subscribe((session) => (received = session));
    const call = http.expectOne('/api/auth/login');
    call.flush(session);

    expect([call.request.method, call.request.body, received]).toEqual(['POST', request, session]);
  });

  it('posts the new account to /api/auth/register', () => {
    const request = { name: 'Ana', email: 'ana@mail.com', password: 'Orbit2026!' };

    gateway.signUp(request).subscribe();
    const call = http.expectOne('/api/auth/register');
    call.flush(fakeSession('Ana'));

    expect([call.request.method, call.request.body]).toEqual(['POST', request]);
  });

  it.each([
    [401, 'invalid-credentials'],
    [409, 'email-taken'],
    [400, 'invalid-input'],
    [500, 'unreachable'],
    [0, 'unreachable'],
  ] as [number, AuthFailureReason][])(
    'fails with a reason when the API answers %i',
    (status, reason) => {
      let failure: unknown;

      gateway
        .signIn({ email: 'a@b.co', password: 'x', remember: false })
        .subscribe({ error: (e) => (failure = e) });
      http.expectOne('/api/auth/login').flush('', { status, statusText: 'error' });

      expect(failure).toBeInstanceOf(AuthFailure);
      expect((failure as AuthFailure).reason).toBe(reason);
    },
  );
});
