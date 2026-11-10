import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { FinancesShowcase } from './finances-showcase/finances-showcase';
import { LANDING_FEATURES, LANDING_HIGHLIGHTS, LANDING_STEPS } from './landing-content';
import { LOGIN_ROUTE, LandingHero } from './landing-hero/landing-hero';
import { RoutinesShowcase } from './routines-showcase/routines-showcase';

/** First page of the site: says what Orbit is, shows its modules and leads to the sign-in. */
@Component({
  selector: 'app-landing',
  imports: [RouterLink, TranslatePipe, LandingHero, RoutinesShowcase, FinancesShowcase],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class Landing {
  protected readonly loginRoute = LOGIN_ROUTE;
  protected readonly highlights = LANDING_HIGHLIGHTS;
  protected readonly features = LANDING_FEATURES;
  protected readonly steps = LANDING_STEPS;
}
