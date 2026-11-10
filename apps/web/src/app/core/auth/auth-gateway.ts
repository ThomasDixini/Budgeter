import { Observable } from 'rxjs';

/** Identity providers offered next to the e-mail form. */
export type SocialProvider = 'google' | 'apple';

export interface SignInRequest {
  readonly email: string;
  readonly password: string;
  /** Keep the session on this device after the browser closes. */
  readonly remember: boolean;
}

export interface SignUpRequest {
  readonly name: string;
  readonly email: string;
  readonly password: string;
}

/**
 * Port to whatever authenticates people. `app.config.ts` binds it to an adapter and tests to a fake;
 * the real authentication is decided in a later phase (AGENTS.md, pending decisions).
 */
export abstract class AuthGateway {
  /** Opens a session with an existing account. */
  abstract signIn(request: SignInRequest): Observable<void>;

  /** Creates an account and opens a session with it. */
  abstract signUp(request: SignUpRequest): Observable<void>;

  /** Sends a link to choose a new password; answers the same whether or not the account exists. */
  abstract requestPasswordReset(email: string): Observable<void>;

  /** Opens a session through an identity provider. */
  abstract signInWith(provider: SocialProvider): Observable<void>;
}
