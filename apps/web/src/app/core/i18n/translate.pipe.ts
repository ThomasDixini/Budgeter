import { Pipe, PipeTransform, inject } from '@angular/core';
import { Translator } from './translator';

/**
 * Translates the English text of a template: `{{ 'Net worth' | t }}`, or with values
 * `{{ '{count} bills' | t: { count: total } }}`. A number or a missing value passes through as text, so
 * the pipe can sit on anything a template shows. Pure on purpose: the language only changes by
 * reloading the page.
 */
@Pipe({ name: 't' })
export class TranslatePipe implements PipeTransform {
  private readonly translator = inject(Translator);

  transform(
    text: string | number | null | undefined,
    params?: Readonly<Record<string, string | number>>,
  ): string {
    if (text === null || text === undefined) return '';
    return this.translator.translate(String(text), params);
  }
}
