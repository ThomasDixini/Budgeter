import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Top bar shared by every screen: brand on the left, profile on the right. */
@Component({
  selector: 'app-header',
  imports: [RouterLink],
  template: `<header class="app-header">
    <a class="brand" routerLink="/">Budgeter</a>
    <ng-content />
    <button class="profile" type="button" aria-label="Profile">
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
  </header>`,
  styleUrl: './app-header.css',
})
export class AppHeader {}
