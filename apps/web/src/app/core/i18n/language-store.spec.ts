import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Language } from './language';
import { LanguagePreference } from './language-preference';
import { LanguageStore } from './language-store';
import { PageReloader } from './page-reloader';

/** Remembers the choice in memory instead of the browser. */
class FakeLanguagePreference extends LanguagePreference {
  saved: Language[] = [];

  override save(language: Language): void {
    this.saved.push(language);
  }
}

/** Counts the reloads instead of leaving the page. */
class FakePageReloader extends PageReloader {
  reloads = 0;

  override reload(): void {
    this.reloads++;
  }
}

function setup(locale: string): {
  store: LanguageStore;
  preference: FakeLanguagePreference;
  reloader: FakePageReloader;
} {
  const preference = new FakeLanguagePreference();
  const reloader = new FakePageReloader();
  TestBed.configureTestingModule({
    providers: [
      { provide: LOCALE_ID, useValue: locale },
      { provide: LanguagePreference, useValue: preference },
      { provide: PageReloader, useValue: reloader },
    ],
  });
  return { store: TestBed.inject(LanguageStore), preference, reloader };
}

describe('LanguageStore', () => {
  it('runs in the language the app started with and marks the page with it', () => {
    const { store } = setup('pt-BR');

    expect([store.current, document.documentElement.lang]).toEqual(['pt-BR', 'pt-BR']);
  });

  it('remembers another language and starts the page again in it', () => {
    const { store, preference, reloader } = setup('en-US');

    store.choose('pt-BR');

    expect([preference.saved, reloader.reloads]).toEqual([['pt-BR'], 1]);
  });

  it('does nothing when the language in use is chosen again', () => {
    const { store, preference, reloader } = setup('en-US');

    store.choose('en-US');

    expect([preference.saved, reloader.reloads]).toEqual([[], 0]);
  });
});
