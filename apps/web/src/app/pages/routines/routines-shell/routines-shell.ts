import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppHeader } from '../../../components/app-header/app-header';
import { ModuleDock } from '../../../components/module-dock/module-dock';
import { APP_MODULES } from '../../../core/modules/module-catalog';
import { RoutinesTabs } from '../routines-tabs/routines-tabs';

/** Frame shared by every Routines & Goals page: header with section tabs, routed page, module dock. */
@Component({
  selector: 'app-routines-shell',
  imports: [RouterOutlet, AppHeader, ModuleDock, RoutinesTabs],
  template: `<div class="shell">
    <div class="glow glow-mint" aria-hidden="true"></div>
    <div class="glow glow-violet" aria-hidden="true"></div>
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
