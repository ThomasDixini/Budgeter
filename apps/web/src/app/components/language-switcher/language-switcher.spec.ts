import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LanguagePreference } from '../../core/i18n/language-preference';
import { PageReloader } from '../../core/i18n/page-reloader';
import { LanguageSwitcher } from './language-switcher';

/** Counts the reloads instead of leaving the page. */
class FakePageReloader extends PageReloader {
  reloads = 0;

  override reload(): void {
    this.reloads++;
  }
}

function render(locale: string): { element: HTMLElement; reloader: FakePageReloader } {
  const reloader = new FakePageReloader();
  TestBed.configureTestingModule({
    providers: [
      { provide: LOCALE_ID, useValue: locale },
      { provide: PageReloader, useValue: reloader },
    ],
  });
  const fixture = TestBed.createComponent(LanguageSwitcher);
  fixture.detectChanges();
  return { element: fixture.nativeElement as HTMLElement, reloader };
}

describe('LanguageSwitcher', () => {
  afterEach(() => TestBed.inject(LanguagePreference).save('en-US'));

  it('marks the language in use', () => {
    const { element } = render('pt-BR');

    expect(
      [...element.querySelectorAll('button')].map((button) => button.getAttribute('aria-pressed')),
    ).toEqual(['false', 'true']);
  });

  it('switches to the other language by starting the page again', () => {
    const { element, reloader } = render('en-US');

    element.querySelectorAll('button')[1].click();

    expect([TestBed.inject(LanguagePreference).read(), reloader.reloads]).toEqual(['pt-BR', 1]);
  });
});
