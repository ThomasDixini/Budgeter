import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LANGUAGE_OPTIONS, Language } from '../../core/i18n/language';
import { LanguageStore } from '../../core/i18n/language-store';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

/** Two small buttons in the header to pick the language of the app; the page starts again in it. */
@Component({
  selector: 'app-language-switcher',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="switcher" role="group" [attr.aria-label]="'Language' | t">
    @for (option of options; track option.value) {
      <button
        class="lang-option"
        type="button"
        [attr.aria-pressed]="option.value === language.current"
        [attr.lang]="option.value"
        [title]="option.name"
        (click)="choose(option.value)"
      >
        {{ option.shortName }}
      </button>
    }
  </div>`,
  styleUrl: './language-switcher.css',
})
export class LanguageSwitcher {
  protected readonly language = inject(LanguageStore);
  protected readonly options = LANGUAGE_OPTIONS;

  protected choose(language: Language): void {
    this.language.choose(language);
  }
}
