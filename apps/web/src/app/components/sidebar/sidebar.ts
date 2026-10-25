import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  template: `<aside [class.sidebar]="true" [class.collapsed]="isCollapsed()">
    <button class="toggle-btn" (click)="toggle()" aria-label="Toggle sidebar">
      {{ isCollapsed() ? '→' : '←' }}
    </button>
    <nav class="nav">
      <a
        routerLink="/"
        routerLinkActive="active"
        [routerLinkActiveOptions]="{ exact: true }"
        class="nav-item"
        ><span class="icon"
          ><svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline></svg></span
        ><span class="label">Home</span></a
      >
    </nav>
  </aside>`,
  styleUrl: './sidebar.css',
})
export class Sidebar {
  protected readonly isCollapsed = signal(false);

  toggle(): void {
    this.isCollapsed.update((v) => !v);
  }
}
