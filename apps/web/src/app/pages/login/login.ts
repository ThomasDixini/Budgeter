import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import {
  AuthFailure,
  AuthFailureReason,
  AuthGateway,
  AuthSession,
} from '../../core/auth/auth-gateway';
import { SessionStore } from '../../core/auth/session-store';
import {
  AccessForm,
  AccessFormErrors,
  AccessMode,
  accessFormErrors,
  hasErrors,
  passwordStrength,
} from '../../core/auth/credential-rules';
import { fieldValue } from '../../core/forms/field-value';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ModuleIcon } from '../../components/module-icon/module-icon';
import { LoginBackdrop } from './login-backdrop/login-backdrop';
import { LoginDome } from './login-dome/login-dome';
import { ACCESS_COPY, FAILURE_MESSAGES, STRENGTH_COLORS, STRENGTH_LABELS } from './login-copy';

/** Where a person lands once signed in: the first module. */
export const APP_HOME_ROUTE = '/routines';

const NO_ERRORS: AccessFormErrors = { name: false, email: false, password: false };
const EMPTY_BAR = 'rgba(255, 255, 255, 0.08)';

/** Sign-in screen: signs in or creates an account, one mode at a time, and keeps the session it gets. */
@Component({
  selector: 'app-login',
  imports: [RouterLink, TranslatePipe, ModuleIcon, LoginBackdrop, LoginDome],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly auth = inject(AuthGateway);
  private readonly sessions = inject(SessionStore);

  protected readonly appHomeRoute = APP_HOME_ROUTE;
  protected readonly mode = signal<AccessMode>('login');
  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly isPasswordShown = signal(false);
  protected readonly remember = signal(true);
  protected readonly isDone = signal(false);
  protected readonly failure = signal<AuthFailureReason | null>(null);
  /** Errors show only after a first submit, so the form doesn't scold while the person types. */
  private readonly wasSubmitted = signal(false);

  protected readonly copy = computed(() => ACCESS_COPY[this.mode()]);
  protected readonly errors = computed(() =>
    this.wasSubmitted() ? accessFormErrors(this.mode(), this.form()) : NO_ERRORS,
  );
  protected readonly strength = computed(() => passwordStrength(this.password()));
  protected readonly strengthLabel = computed(() => STRENGTH_LABELS[this.strength()]);
  protected readonly strengthBars = computed(() => this.barColors());
  protected readonly failureMessage = computed(() => {
    const reason = this.failure();
    return reason === null ? null : FAILURE_MESSAGES[reason];
  });
  protected readonly fieldValue = fieldValue;

  protected switchTo(mode: AccessMode): void {
    this.mode.set(mode);
    this.wasSubmitted.set(false);
    this.isDone.set(false);
    this.failure.set(null);
    this.isPasswordShown.set(false);
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.wasSubmitted.set(true);
    if (hasErrors(accessFormErrors(this.mode(), this.form()))) return;
    this.finish(this.request());
  }

  protected togglePassword(): void {
    this.isPasswordShown.update((shown) => !shown);
  }

  protected toggleRemember(): void {
    this.remember.update((remember) => !remember);
  }

  private form(): AccessForm {
    return { name: this.name(), email: this.email(), password: this.password() };
  }

  private request(): Observable<AuthSession> {
    const email = this.email().trim();
    if (this.mode() === 'signup') {
      return this.auth.signUp({ name: this.name().trim(), email, password: this.password() });
    }
    return this.auth.signIn({ email, password: this.password(), remember: this.remember() });
  }

  private finish(request: Observable<AuthSession>): void {
    this.failure.set(null);
    request.subscribe({
      next: (session) => this.open(session),
      error: (error: unknown) =>
        this.failure.set(error instanceof AuthFailure ? error.reason : 'unreachable'),
    });
  }

  // A new account has no "stay signed in" box, so it keeps the session for this tab only.
  private open(session: AuthSession): void {
    this.sessions.start(session, this.mode() === 'login' && this.remember());
    this.isDone.set(true);
  }

  private barColors(): string[] {
    const score = this.strength();
    const filled = this.password() === '' ? 0 : score;
    const color = STRENGTH_COLORS[Math.max(0, score - 1)];
    return [0, 1, 2, 3].map((bar) => (bar < filled ? color : EMPTY_BAR));
  }
}
