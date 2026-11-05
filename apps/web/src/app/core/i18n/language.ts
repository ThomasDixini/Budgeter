/** Languages the app is written in; the value doubles as the locale of dates, numbers and money. */
export type Language = 'en-US' | 'pt-BR';

export const DEFAULT_LANGUAGE: Language = 'en-US';

/** Choices of the language switcher, in display order. */
export const LANGUAGE_OPTIONS: readonly { value: Language; shortName: string; name: string }[] = [
  { value: 'en-US', shortName: 'EN', name: 'English' },
  { value: 'pt-BR', shortName: 'PT', name: 'Português' },
];

/**
 * Reads a language out of a stored or browser-provided value; undefined when it is not one the app has.
 * @example parseLanguage('pt-BR') // 'pt-BR'
 */
export function parseLanguage(value: string | null | undefined): Language | undefined {
  return LANGUAGE_OPTIONS.find((option) => option.value === value)?.value;
}

/**
 * The language closest to what the browser asks for: Portuguese for any `pt`, English otherwise.
 * @example languageForBrowser('pt-PT') // 'pt-BR'
 */
export function languageForBrowser(browserLanguage: string | undefined): Language {
  return browserLanguage?.toLowerCase().startsWith('pt') ? 'pt-BR' : DEFAULT_LANGUAGE;
}

/**
 * Fills `{name}` placeholders of a text; a placeholder with no value is left as written.
 * @example interpolate('{count} bills', { count: 3 }) // '3 bills'
 */
export function interpolate(
  text: string,
  params: Readonly<Record<string, string | number>>,
): string {
  return text.replaceAll(/\{(\w+)\}/g, (placeholder, name: string) =>
    name in params ? String(params[name]) : placeholder,
  );
}
