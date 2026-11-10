import {
  AccessForm,
  accessFormErrors,
  hasErrors,
  isEmail,
  passwordStrength,
} from './credential-rules';

const filled: AccessForm = { name: 'Ana', email: 'ana@mail.com', password: 'secret-pass' };

describe('isEmail', () => {
  it('accepts an address with a domain', () => {
    expect(isEmail('ana@mail.com')).toBe(true);
  });

  it('rejects text without a domain', () => {
    expect(isEmail('ana@mail')).toBe(false);
  });
});

describe('passwordStrength', () => {
  it('scores an empty password zero', () => {
    expect(passwordStrength('')).toBe(0);
  });

  it('gives one point for length alone', () => {
    expect(passwordStrength('abcdefgh')).toBe(1);
  });

  it('scores length, mixed case, digits and a symbol as strong', () => {
    expect(passwordStrength('Orbit2026!')).toBe(4);
  });
});

describe('accessFormErrors', () => {
  it('lets a filled sign-in through', () => {
    expect(hasErrors(accessFormErrors('login', filled))).toBe(false);
  });

  it('asks for the password when signing in', () => {
    expect(accessFormErrors('login', { ...filled, password: '' }).password).toBe(true);
  });

  it('needs a name only for a new account', () => {
    const nameless = { ...filled, name: ' ' };

    expect(accessFormErrors('signup', nameless).name).toBe(true);
    expect(accessFormErrors('login', nameless).name).toBe(false);
  });

  it('needs at least 8 characters for a new password', () => {
    expect(accessFormErrors('signup', { ...filled, password: 'short' }).password).toBe(true);
  });

  it('needs only a valid e-mail to reset a password', () => {
    const errors = accessFormErrors('reset', { name: '', email: 'ana@mail.com', password: '' });

    expect(hasErrors(errors)).toBe(false);
  });

  it('flags an invalid e-mail in every mode', () => {
    expect(accessFormErrors('reset', { ...filled, email: 'ana' }).email).toBe(true);
  });
});
