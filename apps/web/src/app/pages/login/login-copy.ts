import { AccessMode, PasswordStrength } from '../../core/auth/credential-rules';
import { AuthFailureReason } from '../../core/auth/auth-gateway';

/** Texts that change with the mode of the sign-in screen, in English (the translation keys). */
export interface AccessCopy {
  readonly headline: string;
  readonly subline: string;
  readonly formTitle: string;
  readonly formSubtitle: string;
  readonly submitLabel: string;
  readonly doneTitle: string;
  readonly doneText: string;
  /** The other mode the footer link switches to. */
  readonly switchTo: {
    readonly mode: AccessMode;
    readonly question: string;
    readonly action: string;
  };
}

export const ACCESS_COPY: Readonly<Record<AccessMode, AccessCopy>> = {
  login: {
    headline: 'Welcome back.',
    subline: 'Your routine and your money are waiting where you left them.',
    formTitle: 'Sign in to your account',
    formSubtitle: 'Use your e-mail and password.',
    submitLabel: 'Sign in',
    doneTitle: 'All set!',
    doneText: 'You are signed in to your account.',
    switchTo: { mode: 'signup', question: 'No account yet?', action: 'Create account' },
  },
  signup: {
    headline: 'Start organizing your life.',
    subline: 'Create your account and build your first routine in a few minutes.',
    formTitle: 'Create your account',
    formSubtitle: 'It takes less than a minute.',
    submitLabel: 'Create account',
    doneTitle: 'Account created!',
    doneText: 'Now just open the app and build your first routine.',
    switchTo: { mode: 'login', question: 'Already have an account?', action: 'Sign in' },
  },
};

/** What the person is told for each way a sign-in or sign-up can fail. */
export const FAILURE_MESSAGES: Readonly<Record<AuthFailureReason, string>> = {
  'invalid-credentials': 'Wrong e-mail or password.',
  'email-taken': 'There is already an account with this e-mail.',
  'invalid-input': 'Check your details: the server did not accept them.',
  unreachable: "Couldn't reach your account. Try again.",
};

/** Label under the strength bars, by score. */
export const STRENGTH_LABELS: Readonly<Record<PasswordStrength, string>> = {
  0: 'Use at least 8 characters',
  1: 'Weak password',
  2: 'Fair password',
  3: 'Good password',
  4: 'Strong password',
};

/** Bar color for each score; the score picks one color for every filled bar. */
export const STRENGTH_COLORS: readonly string[] = ['#cc7030', '#b87f06', '#2f97cc', '#14a877'];
