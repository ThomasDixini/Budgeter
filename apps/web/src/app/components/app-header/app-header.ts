import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { isDemoMode } from '../../core/finances/demo/demo-mode';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { BackupMenu } from '../backup-menu/backup-menu';
import { DemoSwitch } from '../demo-switch/demo-switch';
import { LanguageSwitcher } from '../language-switcher/language-switcher';

/** Top bar shared by every screen: brand on the left, profile on the right. */
@Component({
  selector: 'app-header',
  imports: [RouterLink, TranslatePipe, LanguageSwitcher, DemoSwitch, BackupMenu],
  template: `<header class="app-header">
    <a class="brand" routerLink="/">Orbit</a>
    <ng-content />
    <div class="end">
      <!-- The demo shows made-up data, while a backup always holds the person's own: kept apart. -->
      @if (!isDemo) {
        <app-backup-menu />
      }
      <app-demo-switch />
      <app-language-switcher />
      <!-- Disabled until there is an account to show: a button that did nothing looked broken. -->
      <button
        class="profile"
        type="button"
        [attr.aria-label]="'Profile' | t"
        [title]="'Coming soon' | t"
        disabled
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="8" r="4"></circle>
          <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"></path>
        </svg>
      </button>
    </div>
  </header>`,
  styleUrl: './app-header.css',
})
export class AppHeader {
  protected readonly isDemo = isDemoMode();
}
