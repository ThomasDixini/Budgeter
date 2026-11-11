import { Injectable, computed, signal } from '@angular/core';
import { AuthSession, AuthUser } from './auth-gateway';

/** Where the session is kept; read again when the page starts. */
export const SESSION_STORAGE_KEY = 'orbit.session';

/**
 * The signed-in session of this browser. A session someone asked to keep ("stay signed in") lives in
 * `localStorage`, so it survives closing the browser; any other lives in `sessionStorage` and ends with
 * the tab. A session past its expiry is dropped when read, never offered.
 * @example inject(SessionStore).start(session, true)
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly current = signal<AuthSession | null>(this.readStored());

  readonly user = computed<AuthUser | null>(() => this.current()?.user ?? null);
  readonly isSignedIn = computed(() => this.current() !== null);

  /** The token to send with requests, or null when no one is signed in (or it has run out). */
  token(): string | null {
    const session = this.current();
    if (session === null) return null;
    if (isExpired(session)) {
      this.end();
      return null;
    }
    return session.token;
  }

  /** Remembers the session, in the place that matches how long it should last. */
  start(session: AuthSession, remember: boolean): void {
    this.forget();
    this.write(remember ? localStorage : sessionStorage, session);
    this.current.set(session);
  }

  /** Signs out: forgets the session everywhere. */
  end(): void {
    this.forget();
    this.current.set(null);
  }

  private readStored(): AuthSession | null {
    const stored = this.read(localStorage) ?? this.read(sessionStorage);
    if (stored === null || isExpired(stored)) {
      this.forget();
      return null;
    }
    return stored;
  }

  private read(storage: Storage): AuthSession | null {
    try {
      const text = storage.getItem(SESSION_STORAGE_KEY);
      return text === null ? null : (JSON.parse(text) as AuthSession);
    } catch {
      return null;
    }
  }

  private write(storage: Storage, session: AuthSession): void {
    try {
      storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Blocked storage only means the session is lost when the page reloads.
    }
  }

  private forget(): void {
    for (const storage of [localStorage, sessionStorage]) {
      try {
        storage.removeItem(SESSION_STORAGE_KEY);
      } catch {
        // Nothing to forget in storage that cannot be read.
      }
    }
  }
}

function isExpired(session: AuthSession): boolean {
  return Date.parse(session.expiresAt) <= Date.now();
}
