import { Provider } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import {
  AuthFailure,
  AuthFailureReason,
  AuthGateway,
  AuthSession,
  SignInRequest,
  SignUpRequest,
} from './auth-gateway';

/** A session that lasts a day from now, for specs that only need someone signed in. */
export function fakeSession(name = 'Ana'): AuthSession {
  return {
    token: `token-of-${name}`,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    user: { id: `id-of-${name}`, email: `${name.toLowerCase()}@mail.com`, name },
  };
}

/**
 * Binds the auth port to a fake, for specs of the sign-in screen.
 * @example TestBed.configureTestingModule({ providers: [provideFakeAuthGateway(gateway)] })
 */
export function provideFakeAuthGateway(gateway = new FakeAuthGateway()): Provider {
  return { provide: AuthGateway, useValue: gateway };
}

/** Test double that records each call and answers synchronously; set `failure` to make calls fail. */
export class FakeAuthGateway extends AuthGateway {
  failure: AuthFailureReason | undefined;
  readonly signIns: SignInRequest[] = [];
  readonly signUps: SignUpRequest[] = [];

  override signIn(request: SignInRequest): Observable<AuthSession> {
    this.signIns.push(request);
    return this.answer();
  }

  override signUp(request: SignUpRequest): Observable<AuthSession> {
    this.signUps.push(request);
    return this.answer();
  }

  private answer(): Observable<AuthSession> {
    return this.failure === undefined
      ? of(fakeSession())
      : throwError(() => new AuthFailure(this.failure as AuthFailureReason));
  }
}
