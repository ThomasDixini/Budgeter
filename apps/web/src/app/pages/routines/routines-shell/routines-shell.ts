import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ModuleFrame } from '../../../components/module-frame/module-frame';
import { APP_MODULES } from '../../../core/modules/module-catalog';
import { ROUTINES_SECTIONS } from '../../../core/routines/routines-section';

/** Frame shared by every Routines & Goals page: header with section tabs, routed page, module dock. */
@Component({
  selector: 'app-routines-shell',
  imports: [RouterOutlet, ModuleFrame],
  template: `<app-module-frame [module]="routinesModule" [sections]="sections">
    <router-outlet />
  </app-module-frame>`,
  styles: ':host { display: block; }',
})
export class RoutinesShell {
  protected readonly routinesModule = APP_MODULES[0];
  protected readonly sections = ROUTINES_SECTIONS;
}
