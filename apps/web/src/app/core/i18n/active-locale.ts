import { DEFAULT_LANGUAGE, Language } from './language';

let active: Language = DEFAULT_LANGUAGE;

/**
 * The language the app started in, for plain functions that format dates and have no way to inject
 * `LOCALE_ID`. Set once when the app starts; it never changes while the app runs.
 * @example formatDate(day, 'MMM d', activeLocale())
 */
export function activeLocale(): Language {
  return active;
}

/** @example setActiveLocale('pt-BR') */
export function setActiveLocale(language: Language): void {
  active = language;
}
