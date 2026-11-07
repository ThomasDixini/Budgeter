import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Translator } from '../translator';

function portugueseTranslator(): Translator {
  TestBed.configureTestingModule({ providers: [{ provide: LOCALE_ID, useValue: 'pt-BR' }] });
  return TestBed.inject(Translator);
}

describe('names the database starts with', () => {
  it('are translated to Portuguese', () => {
    const translator = portugueseTranslator();

    expect(
      ['Checking account', 'Study', 'Weekdays', 'C# study', 'Read 20 pages'].map((name) =>
        translator.translate(name),
      ),
    ).toEqual(['Conta corrente', 'Estudo', 'Dias úteis', 'Estudo de C#', 'Ler 20 páginas']);
  });

  it('leave a name the person typed exactly as typed', () => {
    expect(portugueseTranslator().translate('Gym with Ana')).toBe('Gym with Ana');
  });

  it('stay in English in en-US', () => {
    TestBed.configureTestingModule({ providers: [{ provide: LOCALE_ID, useValue: 'en-US' }] });

    expect(TestBed.inject(Translator).translate('Weekdays')).toBe('Weekdays');
  });
});
