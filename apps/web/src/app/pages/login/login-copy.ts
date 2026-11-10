import { AccessMode, PasswordStrength } from '../../core/auth/credential-rules';

/** Texts that change with the mode of the sign-in screen, in English (the translation keys). */
export interface AccessCopy {
  readonly headline: string;
  readonly subline: string;
  readonly formTitle: string;
  readonly formSubtitle: string;
  readonly submitLabel: string;
  readonly doneTitle: string;
  readonly doneText: string;
  /** The other mode the footer link switches to; absent while resetting a password. */
  readonly switchTo?: {
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
    formSubtitle: 'Use your e-mail and password or continue with an account.',
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
  reset: {
    headline: 'It happens to everyone.',
    subline: 'Let us help you get back to your account.',
    formTitle: 'Recover password',
    formSubtitle:
      'Type the e-mail of your account and we will send a link to create a new password.',
    submitLabel: 'Send link',
    doneTitle: 'Link sent',
    doneText: 'If there is an account with this e-mail, you will get the link in a few minutes.',
  },
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
