import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { SessionStore } from './session-store';

const API_PREFIX = '/api/';
const OPEN_PREFIX = '/api/auth/';

/**
 * Sends the session's token with every call to the API, and signs out when the API stops accepting it
 * (expired or revoked): the person lands on the sign-in screen instead of on screens that fail to load.
 * The sign-in calls themselves carry no token, and their 401 means "wrong password", not "expired".
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(SessionStore);
  const router = inject(Router);
  if (!request.url.startsWith(API_PREFIX) || request.url.startsWith(OPEN_PREFIX)) {
    return next(request);
  }
  const token = session.token();
  const sent =
    token === null ? request : request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  return next(sent).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && token !== null) {
        session.end();
        void router.navigateByUrl('/login');
      }
      return throwError(() => error);
    }),
  );
};
