import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppHeader } from '../../../components/app-header/app-header';
import { FireGlow } from '../../../components/fire-glow/fire-glow';
import { ModuleDock } from '../../../components/module-dock/module-dock';
import { APP_MODULES } from '../../../core/modules/module-catalog';
import { RoutinesTabs } from '../routines-tabs/routines-tabs';

/** Frame shared by every Routines & Goals page: header with section tabs, routed page, module dock. */
@Component({
  selector: 'app-routines-shell',
  imports: [RouterOutlet, AppHeader, FireGlow, ModuleDock, RoutinesTabs],
  template: `<div class="shell">
    <app-fire-glow class="fire" />
    <app-header>
      <app-routines-tabs class="tabs" />
    </app-header>
    <main class="content">
      <router-outlet />
    </main>
    <app-module-dock [current]="routinesModule" />
  </div>`,
  styleUrl: './routines-shell.css',
})
export class RoutinesShell {
  protected readonly routinesModule = APP_MODULES[0];
}
