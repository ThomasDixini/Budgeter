import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { AppModule, accentRgbVariable, isModuleAvailable } from '../../core/modules/app-module';
import { APP_MODULES } from '../../core/modules/module-catalog';
import { wrapIndex } from '../../core/modules/module-wheel';
import { ModuleIcon } from '../module-icon/module-icon';

/** One of the two modules shown beside the current one on the dock. */
interface DockNeighbour {
  readonly module: AppModule;
  readonly side: 'previous' | 'next';
  readonly label: string;
  readonly isAvailable: boolean;
}

/**
 * Small dome pinned to the bottom of module pages: the current module flanked by its wheel neighbours.
 * A built neighbour opens its module directly; the page transition spins the dome towards it.
 */
@Component({
  selector: 'app-module-dock',
  imports: [RouterLink, ModuleIcon, TranslatePipe],
  templateUrl: './module-dock.html',
  styleUrl: './module-dock.css',
})
export class ModuleDock {
  readonly current = input.required<AppModule>();

  protected readonly accentRgb = computed(() => accentRgbVariable(this.current().accent));
  protected readonly neighbours = computed((): readonly DockNeighbour[] => [
    this.neighbourOn('previous', -1, 'Previous module: {name}'),
    this.neighbourOn('next', 1, 'Next module: {name}'),
  ]);

  private neighbourOn(side: DockNeighbour['side'], step: number, label: string): DockNeighbour {
    const index = APP_MODULES.findIndex((module) => module === this.current());
    const module = APP_MODULES[wrapIndex(index + step, APP_MODULES.length)];
    return { module, side, label, isAvailable: isModuleAvailable(module) };
  }
}
