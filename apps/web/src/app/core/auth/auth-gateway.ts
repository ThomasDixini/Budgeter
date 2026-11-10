import { Observable } from 'rxjs';

export interface SignInRequest {
  readonly email: string;
  readonly password: string;
  /** Ask for a token that lasts weeks instead of hours. */
  readonly remember: boolean;
}

export interface SignUpRequest {
  readonly name: string;
  readonly email: string;
  readonly password: string;
}

export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
}

/** What the API hands back once someone is signed in. */
export interface AuthSession {
  /** Sent as `Authorization: Bearer ...` with every request. */
  readonly token: string;
  /** ISO moment the token stops being accepted. */
  readonly expiresAt: string;
  readonly user: AuthUser;
}

/** Why a sign-in or sign-up did not go through. */
export type AuthFailureReason =
  'invalid-credentials' | 'email-taken' | 'invalid-input' | 'unreachable';

/** Error a gateway fails with; the reason says what to tell the person. */
export class AuthFailure extends Error {
  constructor(readonly reason: AuthFailureReason) {
    super(`Expected the sign-in to go through, failed with "${reason}"`);
  }
}

/**
 * Port to whatever authenticates people. `app.config.ts` binds it to the HTTP adapter and tests to a
 * fake. Both calls fail with an `AuthFailure`.
 */
export abstract class AuthGateway {
  /** Opens a session with an existing account. */
  abstract signIn(request: SignInRequest): Observable<AuthSession>;

  /** Creates an account and opens a session with it. */
  abstract signUp(request: SignUpRequest): Observable<AuthSession>;
}
