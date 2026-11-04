import { Injectable } from '@angular/core';

/**
 * Reloads the page. The language is the locale the app starts with, so a change applies by starting
 * again; kept apart so tests can swap it for a fake that only records the call.
 */
@Injectable({ providedIn: 'root' })
export class PageReloader {
  /** @example inject(PageReloader).reload() */
  reload(): void {
    location.reload();
  }
}
