import { Observable, of } from 'rxjs';
import { AuthGateway } from './auth-gateway';

/**
 * Stand-in until the authentication backend exists: accepts every request without checking it, so the
 * sign-in screen can be used end to end. Replace the binding in `app.config.ts` once auth is built.
 */
export class UnconnectedAuthGateway extends AuthGateway {
  override signIn(): Observable<void> {
    return of(undefined);
  }

  override signUp(): Observable<void> {
    return of(undefined);
  }

  override requestPasswordReset(): Observable<void> {
    return of(undefined);
  }

  override signInWith(): Observable<void> {
    return of(undefined);
  }
}
