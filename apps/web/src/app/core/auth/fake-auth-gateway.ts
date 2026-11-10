import { Provider } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { AuthGateway, SignInRequest, SignUpRequest, SocialProvider } from './auth-gateway';

/**
 * Binds the auth port to a fake, for specs of the sign-in screen.
 * @example TestBed.configureTestingModule({ providers: [provideFakeAuthGateway(gateway)] })
 */
export function provideFakeAuthGateway(gateway = new FakeAuthGateway()): Provider {
  return { provide: AuthGateway, useValue: gateway };
}

/** Test double that records each call and answers synchronously; set `failure` to make calls fail. */
export class FakeAuthGateway extends AuthGateway {
  failure: unknown;
  readonly signIns: SignInRequest[] = [];
  readonly signUps: SignUpRequest[] = [];
  readonly resets: string[] = [];
  readonly providers: SocialProvider[] = [];

  override signIn(request: SignInRequest): Observable<void> {
    this.signIns.push(request);
    return this.answer();
  }

  override signUp(request: SignUpRequest): Observable<void> {
    this.signUps.push(request);
    return this.answer();
  }

  override requestPasswordReset(email: string): Observable<void> {
    this.resets.push(email);
    return this.answer();
  }

  override signInWith(provider: SocialProvider): Observable<void> {
    this.providers.push(provider);
    return this.answer();
  }

  private answer(): Observable<void> {
    return this.failure === undefined ? of(undefined) : throwError(() => this.failure);
  }
}
