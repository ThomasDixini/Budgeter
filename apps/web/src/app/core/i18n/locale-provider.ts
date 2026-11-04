import { LOCALE_ID, Provider } from '@angular/core';
import { LanguagePreference } from './language-preference';
import { inject } from '@angular/core';

/**
 * Starts the app in the remembered language: every date, number and amount is already formatted from
 * `LOCALE_ID`, so this is what turns them into pt-BR or en-US.
 * @example providers: [provideLanguage()]
 */
export function provideLanguage(): Provider {
  return { provide: LOCALE_ID, useFactory: () => inject(LanguagePreference).read() };
}
