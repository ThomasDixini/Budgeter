import { registerLocaleData } from '@angular/common';
import localePortuguese from '@angular/common/locales/pt';
import {
  EnvironmentProviders,
  LOCALE_ID,
  Provider,
  inject,
  provideAppInitializer,
} from '@angular/core';
import { setActiveLocale } from './active-locale';
import { LanguagePreference } from './language-preference';

// Angular only formats dates for a locale it has data for; English is built in.
registerLocaleData(localePortuguese, 'pt-BR');

/**
 * Starts the app in the remembered language: every date, number and amount is already formatted from
 * `LOCALE_ID`, so this is what turns them into pt-BR or en-US. Plain functions that cannot inject it read
 * the same language from `activeLocale()`.
 * @example providers: [provideLanguage()]
 */
export function provideLanguage(): (Provider | EnvironmentProviders)[] {
  return [
    { provide: LOCALE_ID, useFactory: () => inject(LanguagePreference).read() },
    provideAppInitializer(() => setActiveLocale(inject(LanguagePreference).read())),
  ];
}
