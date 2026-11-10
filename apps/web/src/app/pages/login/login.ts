import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthGateway, SocialProvider } from '../../core/auth/auth-gateway';
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
import { ACCESS_COPY, STRENGTH_COLORS, STRENGTH_LABELS } from './login-copy';

/** Where a person lands once signed in: the first module. */
export const APP_HOME_ROUTE = '/routines';

const NO_ERRORS: AccessFormErrors = { name: false, email: false, password: false };
const EMPTY_BAR = 'rgba(255, 255, 255, 0.08)';

/** Sign-in screen: signs in, creates an account or asks for a new password, one mode at a time. */
@Component({
  selector: 'app-login',
  imports: [RouterLink, TranslatePipe, ModuleIcon],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly auth = inject(AuthGateway);

  protected readonly appHomeRoute = APP_HOME_ROUTE;
  protected readonly mode = signal<AccessMode>('login');
  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly isPasswordShown = signal(false);
  protected readonly remember = signal(true);
  protected readonly isDone = signal(false);
  protected readonly hasFailed = signal(false);
  /** Errors show only after a first submit, so the form doesn't scold while the person types. */
  private readonly wasSubmitted = signal(false);

  protected readonly copy = computed(() => ACCESS_COPY[this.mode()]);
  protected readonly errors = computed(() =>
    this.wasSubmitted() ? accessFormErrors(this.mode(), this.form()) : NO_ERRORS,
  );
  protected readonly strength = computed(() => passwordStrength(this.password()));
  protected readonly strengthLabel = computed(() => STRENGTH_LABELS[this.strength()]);
  protected readonly strengthBars = computed(() => this.barColors());
  protected readonly fieldValue = fieldValue;

  protected switchTo(mode: AccessMode): void {
    this.mode.set(mode);
    this.wasSubmitted.set(false);
    this.isDone.set(false);
    this.hasFailed.set(false);
    this.isPasswordShown.set(false);
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.wasSubmitted.set(true);
    if (hasErrors(accessFormErrors(this.mode(), this.form()))) return;
    this.finish(this.request());
  }

  protected signInWith(provider: SocialProvider): void {
    this.finish(this.auth.signInWith(provider));
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

  private request(): Observable<void> {
    const email = this.email().trim();
    if (this.mode() === 'reset') return this.auth.requestPasswordReset(email);
    if (this.mode() === 'signup') {
      return this.auth.signUp({ name: this.name().trim(), email, password: this.password() });
    }
    return this.auth.signIn({ email, password: this.password(), remember: this.remember() });
  }

  private finish(request: Observable<void>): void {
    this.hasFailed.set(false);
    request.subscribe({
      next: () => this.isDone.set(true),
      error: () => this.hasFailed.set(true),
    });
  }

  private barColors(): string[] {
    const score = this.strength();
    const filled = this.password() === '' ? 0 : score;
    const color = STRENGTH_COLORS[Math.max(0, score - 1)];
    return [0, 1, 2, 3].map((bar) => (bar < filled ? color : EMPTY_BAR));
  }
}
