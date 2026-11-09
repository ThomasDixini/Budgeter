import { Injectable } from '@angular/core';
import { Language, languageForBrowser, parseLanguage } from './language';

/** Where the chosen language is kept between visits. */
export const LANGUAGE_STORAGE_KEY = 'orbit.language';

/**
 * The language the person picked, remembered in the browser. With nothing remembered (or when storage is
 * blocked, as in a private window) it follows the browser's language.
 */
@Injectable({ providedIn: 'root' })
export class LanguagePreference {
  /** @example inject(LanguagePreference).read() // 'pt-BR' */
  read(): Language {
    return parseLanguage(this.stored()) ?? languageForBrowser(this.browserLanguage());
  }

  /** @example inject(LanguagePreference).save('pt-BR') */
  save(language: Language): void {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Blocked storage only means the choice is not remembered next time.
    }
  }

  private stored(): string | null {
    try {
      return localStorage.getItem(LANGUAGE_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private browserLanguage(): string | undefined {
    return typeof navigator === 'undefined' ? undefined : navigator.language;
  }
}
