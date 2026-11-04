import { TestBed } from '@angular/core/testing';
import { LANGUAGE_STORAGE_KEY, LanguagePreference } from './language-preference';

describe('LanguagePreference', () => {
  afterEach(() => localStorage.removeItem(LANGUAGE_STORAGE_KEY));

  it('remembers the language that was saved', () => {
    const preference = TestBed.inject(LanguagePreference);

    preference.save('pt-BR');

    expect(preference.read()).toBe('pt-BR');
  });

  it('ignores a stored value that is not a language of the app', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'klingon');

    expect(TestBed.inject(LanguagePreference).read()).toBe('en-US');
  });
});
