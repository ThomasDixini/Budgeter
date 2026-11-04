import { Injectable, inject } from '@angular/core';
import { LanguageStore } from './language-store';
import { Language, interpolate } from './language';
import { PT_BR } from './translations/pt-br';

type Dictionary = Readonly<Record<string, string>>;

/** A dictionary key with `{placeholders}`, ready to recognise a sentence already filled in. */
interface Pattern {
  readonly key: string;
  readonly regex: RegExp;
  readonly names: readonly string[];
}

/** Translations by language, keyed by the English text. English is the source, so it has none to list. */
const DICTIONARIES: Readonly<Record<Language, Dictionary>> = {
  'en-US': {},
  'pt-BR': PT_BR,
};

const PLACEHOLDER = /\{(\w+)\}/g;
const MAX_NESTING = 6;
/** Placeholders that stand for a whole number, so `{count} goals` never takes `Study goals`. */
const NUMERIC_PLACEHOLDERS = new Set(['count', 'number']);

/**
 * Turns the English text of the app into the language in use. A text with no translation shows in
 * English, so a missing entry is a visible gap and never a blank or a broken screen.
 *
 * Values that change (names, amounts) go in `{placeholders}` that the translation keeps:
 * `translate('{count} bills', { count: 3 })`. A sentence that was already filled in by code
 * (`'Overdue by 4 days'`) is recognised by the key it came from (`'Overdue by {days}'`), and each filled
 * value is translated on its own (`'4 days'` by `'{count} days'`), so such sentences need no change in the
 * code that builds them.
 */
@Injectable({ providedIn: 'root' })
export class Translator {
  private readonly dictionary = DICTIONARIES[inject(LanguageStore).current];
  private readonly patterns = buildPatterns(this.dictionary);

  /** @example inject(Translator).translate('Net worth') // 'Patrimônio' in pt-BR */
  translate(text: string, params: Readonly<Record<string, string | number>> = {}): string {
    return this.translateNested(text, params, MAX_NESTING);
  }

  private translateNested(
    text: string,
    params: Readonly<Record<string, string | number>>,
    depth: number,
  ): string {
    const exact = this.dictionary[text];
    if (exact !== undefined) return interpolate(exact, params);
    const filled = interpolate(text, params);
    return this.translatePattern(filled, depth) ?? filled;
  }

  private translatePattern(text: string, depth: number): string | undefined {
    if (depth <= 0 || Object.keys(this.dictionary).length === 0) return undefined;
    for (const pattern of this.patterns) {
      const match = pattern.regex.exec(text);
      if (match === null) continue;
      const values = Object.fromEntries(
        pattern.names.map((name, index) => [
          name,
          this.translateNested(match[index + 1], {}, depth - 1),
        ]),
      );
      return interpolate(this.dictionary[pattern.key], values);
    }
    return undefined;
  }
}

/** Patterns of the keys that have placeholders, most specific (most fixed text) first. */
function buildPatterns(dictionary: Dictionary): Pattern[] {
  return Object.keys(dictionary)
    .filter((key) => /\{\w+\}/.test(key))
    .map((key) => toPattern(key))
    .sort(
      (first, second) =>
        fixedLength(second.key) - fixedLength(first.key) ||
        numericCount(second.key) - numericCount(first.key),
    );
}

function toPattern(key: string): Pattern {
  const names: string[] = [];
  const source = key
    .split(PLACEHOLDER)
    .map((piece, index) => {
      if (index % 2 === 1) {
        names.push(piece);
        return NUMERIC_PLACEHOLDERS.has(piece) ? '(\\d+)' : '(.+?)';
      }
      return piece.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
    })
    .join('');
  return { key, regex: new RegExp(`^${source}$`, 's'), names };
}

function numericCount(key: string): number {
  return [...key.matchAll(PLACEHOLDER)].filter((match) => NUMERIC_PLACEHOLDERS.has(match[1]))
    .length;
}

function fixedLength(key: string): number {
  return key.replaceAll(PLACEHOLDER, '').length;
}
