import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import {
  AuthFailure,
  AuthFailureReason,
  AuthGateway,
  AuthSession,
  SignInRequest,
  SignUpRequest,
} from './auth-gateway';

const LOGIN_URL = '/api/auth/login';
const REGISTER_URL = '/api/auth/register';

/** The sign-in and sign-up of the Orbit API. */
@Injectable()
export class HttpAuthGateway extends AuthGateway {
  private readonly httpClient = inject(HttpClient);

  override signIn(request: SignInRequest): Observable<AuthSession> {
    return this.httpClient.post<AuthSession>(LOGIN_URL, request).pipe(catchError(failureOf));
  }

  override signUp(request: SignUpRequest): Observable<AuthSession> {
    return this.httpClient.post<AuthSession>(REGISTER_URL, request).pipe(catchError(failureOf));
  }
}

function failureOf(error: unknown): Observable<never> {
  return throwError(() => new AuthFailure(reasonOf(error)));
}

function reasonOf(error: unknown): AuthFailureReason {
  if (!(error instanceof HttpErrorResponse)) return 'unreachable';
  if (error.status === 401) return 'invalid-credentials';
  if (error.status === 409) return 'email-taken';
  if (error.status === 400) return 'invalid-input';
  return 'unreachable';
}
