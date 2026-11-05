import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Translator } from './translator';
import { PT_BR } from './translations/pt-br';

function translatorIn(locale: string): Translator {
  TestBed.configureTestingModule({ providers: [{ provide: LOCALE_ID, useValue: locale }] });
  return TestBed.inject(Translator);
}

describe('Translator', () => {
  it('keeps the English text in en-US', () => {
    expect(translatorIn('en-US').translate('Net worth')).toBe('Net worth');
  });

  it('translates to pt-BR', () => {
    expect(translatorIn('pt-BR').translate('Net worth')).toBe('Patrimônio');
  });

  it('fills the values of a translated text', () => {
    expect(
      translatorIn('pt-BR').translate('Module {position} of {total}', { position: 1, total: 4 }),
    ).toBe('Módulo 1 de 4');
  });

  it('shows the English text when there is no translation, with its values filled', () => {
    expect(translatorIn('pt-BR').translate('{count} unlisted', { count: 3 })).toBe('3 unlisted');
  });

  it('recognises a sentence the code already filled in and translates each filled value', () => {
    const translator = translatorIn('pt-BR');

    expect([
      translator.translate('Overdue by 4 days'),
      translator.translate('Due today (nov. 3)'),
      translator.translate('Food · Due in 1 day (Oct 30)'),
    ]).toEqual([
      'Atrasada há 4 dias',
      'Vence hoje (nov. 3)',
      'Alimentação · Vence em 1 dia (Oct 30)',
    ]);
  });

  it('keeps every placeholder of the English text in its translation', () => {
    const placeholders = (text: string): string[] => (text.match(/\{\w+\}/g) ?? []).sort();

    const broken = Object.entries(PT_BR).filter(
      ([english, portuguese]) => placeholders(english).join() !== placeholders(portuguese).join(),
    );

    expect(broken).toEqual([]);
  });
});
