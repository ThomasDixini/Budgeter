import { Pipe, PipeTransform, inject } from '@angular/core';
import { Translator } from './translator';

/**
 * Translates the English text of a template: `{{ 'Net worth' | t }}`, or with values
 * `{{ '{count} bills' | t: { count: total } }}`. Pure on purpose: the language only changes by
 * reloading the page.
 */
@Pipe({ name: 't' })
export class TranslatePipe implements PipeTransform {
  private readonly translator = inject(Translator);

  transform(text: string, params?: Readonly<Record<string, string | number>>): string {
    return this.translator.translate(text, params);
  }
}
