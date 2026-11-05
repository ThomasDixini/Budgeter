import { DOCUMENT } from '@angular/common';
import { Injectable, LOCALE_ID, inject } from '@angular/core';
import { Language, parseLanguage, DEFAULT_LANGUAGE } from './language';
import { LanguagePreference } from './language-preference';
import { PageReloader } from './page-reloader';

/**
 * The language the app is running in and the way to change it. The language is the app's `LOCALE_ID`, set
 * when it starts from what the person picked last time, so choosing another one is remembered and the
 * page starts again in it.
 */
@Injectable({ providedIn: 'root' })
export class LanguageStore {
  private readonly preference = inject(LanguagePreference);
  private readonly reloader = inject(PageReloader);

  readonly current: Language = parseLanguage(inject(LOCALE_ID)) ?? DEFAULT_LANGUAGE;

  constructor() {
    // Screen readers and the browser pick voice and hyphenation from the page language.
    inject(DOCUMENT).documentElement.lang = this.current;
  }

  /**
   * Switches to another language; choosing the one already in use does nothing.
   * @example inject(LanguageStore).choose('pt-BR')
   */
  choose(language: Language): void {
    if (language === this.current) return;
    this.preference.save(language);
    this.reloader.reload();
  }
}
