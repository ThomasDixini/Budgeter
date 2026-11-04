import { Component, inject } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { UserNotices } from '../../core/notices/user-notices';

/** Banner telling the user that something went wrong, on every screen, until dismissed. */
@Component({
  selector: 'app-notice',
  imports: [TranslatePipe],
  template: `@if (notices.message(); as message) {
    <div class="notice" role="alert">
      <p class="text">{{ message | t }}</p>
      <button
        class="dismiss"
        type="button"
        [attr.aria-label]="'Dismiss' | t"
        (click)="notices.dismiss()"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M6 6l12 12M18 6L6 18"></path>
        </svg>
      </button>
    </div>
  }`,
  styleUrl: './app-notice.css',
})
export class AppNotice {
  protected readonly notices = inject(UserNotices);
}
