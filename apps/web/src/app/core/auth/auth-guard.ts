import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { isDemoMode } from '../finances/demo/demo-mode';
import { SessionStore } from './session-store';

/**
 * Lets only a signed-in person into a module, and sends anyone else to the sign-in screen. The demo shows
 * made-up data from the browser alone, so it needs no account.
 * @example { path: 'routines', canActivate: [authGuard], ... }
 */
export const authGuard: CanActivateFn = () => {
  if (isDemoMode() || inject(SessionStore).token() !== null) return true;
  return inject(Router).createUrlTree(['/login']);
};
