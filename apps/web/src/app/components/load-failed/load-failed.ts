import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

/** Says the page's data could not be loaded and offers to try again, instead of loading forever. */
@Component({
  selector: 'app-load-failed',
  imports: [TranslatePipe],
  template: `<div class="load-failed" role="status">
    <p class="ui-muted">{{ message() | t }}</p>
    <button class="ui-button-ghost" type="button" (click)="retry.emit()">
      {{ 'Try again' | t }}
    </button>
  </div>`,
  styles: `
    .load-failed {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }

    p {
      margin: 0;
    }
  `,
})
export class LoadFailed {
  readonly message = input("Couldn't load your data.");
  readonly retry = output();
}
