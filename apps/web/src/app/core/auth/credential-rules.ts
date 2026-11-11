/** The two things the sign-in screen does. */
export type AccessMode = 'login' | 'signup';

/** What the person typed on the sign-in screen. */
export interface AccessForm {
  readonly name: string;
  readonly email: string;
  readonly password: string;
}

/** Which fields of the form are wrong for the current mode. */
export interface AccessFormErrors {
  readonly name: boolean;
  readonly email: boolean;
  readonly password: boolean;
}

/** A new account's password needs at least this many characters. */
export const MIN_NEW_PASSWORD_LENGTH = 8;

/** Password strength, from 0 (too short to judge) to 4 (strong). */
export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Tells whether the text looks like an e-mail address.
 * @example isEmail('ana@mail.com') // true
 */
export function isEmail(text: string): boolean {
  return EMAIL_SHAPE.test(text.trim());
}

/**
 * Scores a password by length, mixed case, digits and symbols; one point each.
 * @example passwordStrength('Orbit2026!') // 4
 */
export function passwordStrength(password: string): PasswordStrength {
  const checks = [
    password.length >= MIN_NEW_PASSWORD_LENGTH,
    /[A-Z]/.test(password) && /[a-z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password) || password.length >= 12,
  ];
  return checks.filter(Boolean).length as PasswordStrength;
}

/**
 * Finds the fields that block the form in the given mode: signing in needs an e-mail and a password, a
 * new account also needs a name and a long enough password.
 * @example accessFormErrors('login', { name: '', email: 'ana@mail.com', password: '' }).password // true
 */
export function accessFormErrors(mode: AccessMode, form: AccessForm): AccessFormErrors {
  return {
    name: mode === 'signup' && form.name.trim() === '',
    email: !isEmail(form.email),
    password: !isPasswordAccepted(mode, form.password),
  };
}

/**
 * Tells whether any field blocks the form.
 * @example hasErrors({ name: false, email: true, password: false }) // true
 */
export function hasErrors(errors: AccessFormErrors): boolean {
  return errors.name || errors.email || errors.password;
}

function isPasswordAccepted(mode: AccessMode, password: string): boolean {
  return mode === 'signup' ? password.length >= MIN_NEW_PASSWORD_LENGTH : password.length > 0;
}
