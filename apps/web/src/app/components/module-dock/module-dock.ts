import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppModule, accentRgbVariable } from '../../core/modules/app-module';
import { APP_MODULES } from '../../core/modules/module-catalog';
import { wrapIndex } from '../../core/modules/module-wheel';
import { ModuleIcon } from '../module-icon/module-icon';

/** Small dome pinned to the bottom of module pages: the current module flanked by its wheel neighbours. */
@Component({
  selector: 'app-module-dock',
  imports: [RouterLink, ModuleIcon],
  templateUrl: './module-dock.html',
  styleUrl: './module-dock.css',
})
export class ModuleDock {
  readonly current = input.required<AppModule>();

  protected readonly accentRgb = computed(() => accentRgbVariable(this.current().accent));
  protected readonly previous = computed(() => this.neighbour(-1));
  protected readonly next = computed(() => this.neighbour(1));

  private neighbour(step: number): AppModule {
    const index = APP_MODULES.findIndex((module) => module === this.current());
    return APP_MODULES[wrapIndex(index + step, APP_MODULES.length)];
  }
}
