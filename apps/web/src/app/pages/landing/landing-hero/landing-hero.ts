import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageSwitcher } from '../../../components/language-switcher/language-switcher';
import { ModuleIcon } from '../../../components/module-icon/module-icon';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import {
  accentRgbVariable,
  accentVariable,
  isModuleAvailable,
} from '../../../core/modules/app-module';
import { APP_MODULES } from '../../../core/modules/module-catalog';
import { activeModuleIndex } from '../../../core/modules/module-wheel';
import { ModuleWheelNav } from '../module-wheel-nav/module-wheel-nav';

/** Route of the sign-in screen; every call to action to sign in leads here. */
export const LOGIN_ROUTE = '/login';

/** Top of the landing page: navigation, headline, the sign-in call to action and the module wheel. */
@Component({
  selector: 'app-landing-hero',
  imports: [RouterLink, LanguageSwitcher, ModuleIcon, ModuleWheelNav, TranslatePipe],
  templateUrl: './landing-hero.html',
  styleUrl: './landing-hero.css',
})
export class LandingHero {
  protected readonly loginRoute = LOGIN_ROUTE;
  protected readonly modules = APP_MODULES;
  /** Unbounded step count; wrapped only when reading the active module. */
  protected readonly rotation = signal(0);
  protected readonly activeModule = computed(
    () => this.modules[activeModuleIndex(this.rotation(), this.modules.length)],
  );
  protected readonly accentRgb = computed(() => accentRgbVariable(this.activeModule().accent));
  protected readonly accent = computed(() => accentVariable(this.activeModule().accent));
  protected readonly openRoute = computed(() =>
    isModuleAvailable(this.activeModule()) ? this.activeModule().route : undefined,
  );

  protected rotateBy(steps: number): void {
    this.rotation.update((rotation) => rotation + steps);
  }
}
