import { interpolate, languageForBrowser, parseLanguage } from './language';

describe('language', () => {
  it('only accepts the languages the app has', () => {
    expect([
      parseLanguage('pt-BR'),
      parseLanguage('en-US'),
      parseLanguage('fr'),
      parseLanguage(null),
    ]).toEqual(['pt-BR', 'en-US', undefined, undefined]);
  });

  it('follows the browser: Portuguese for any pt, English otherwise', () => {
    expect([
      languageForBrowser('pt-PT'),
      languageForBrowser('PT'),
      languageForBrowser('de'),
      languageForBrowser(undefined),
    ]).toEqual(['pt-BR', 'pt-BR', 'en-US', 'en-US']);
  });

  it('fills placeholders and leaves unknown ones as written', () => {
    expect(interpolate('{count} of {total} {missing}', { count: 2, total: '5' })).toBe(
      '2 of 5 {missing}',
    );
  });
});
