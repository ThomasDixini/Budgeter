import { Injectable, inject } from '@angular/core';
import { LanguageStore } from './language-store';
import { Language, interpolate } from './language';
import { PT_BR } from './translations/pt-br';

/** Translations by language, keyed by the English text. English is the source, so it has none to list. */
const DICTIONARIES: Readonly<Record<Language, Readonly<Record<string, string>>>> = {
  'en-US': {},
  'pt-BR': PT_BR,
};

/**
 * Turns the English text of the app into the language in use. A text with no translation shows in
 * English, so a missing entry is a visible gap and never a blank or a broken screen.
 *
 * Values that change (names, amounts) go in `{placeholders}` that the translation keeps:
 * `translate('{count} bills', { count: 3 })`.
 */
@Injectable({ providedIn: 'root' })
export class Translator {
  private readonly dictionary = DICTIONARIES[inject(LanguageStore).current];

  /** @example inject(Translator).translate('Net worth') // 'Patrimônio' in pt-BR */
  translate(text: string, params: Readonly<Record<string, string | number>> = {}): string {
    return interpolate(this.dictionary[text] ?? text, params);
  }
}
