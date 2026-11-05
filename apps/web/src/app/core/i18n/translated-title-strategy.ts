import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { Translator } from './translator';

/**
 * Sets the browser tab title from the route's `title`, translated like the rest of the app. Routes keep
 * their English titles (`'Today · Routines & Goals'`), so a new page needs no extra step.
 */
@Injectable({ providedIn: 'root' })
export class TranslatedTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly translator = inject(Translator);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const title = this.buildTitle(snapshot);
    if (title !== undefined) this.title.setTitle(this.translator.translate(title));
  }
}
