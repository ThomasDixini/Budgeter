import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

/** Placeholder where the sign-in form will live; the landing page already leads here. */
@Component({
  selector: 'app-login',
  imports: [RouterLink, TranslatePipe],
  template: `<main class="login">
    <a class="brand" routerLink="/">Orbit</a>
    <h1>{{ 'Sign in' | t }}</h1>
    <p>{{ 'Accounts are coming soon.' | t }}</p>
    <a class="back" routerLink="/">{{ 'Back to start' | t }}</a>
  </main>`,
  styleUrl: './login.css',
})
export class Login {}
