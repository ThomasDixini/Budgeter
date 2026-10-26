import { Component, computed, signal } from '@angular/core';
import { AppHeader } from '../../components/app-header/app-header';
import { accentRgbVariable } from '../../core/modules/app-module';
import { APP_MODULES } from '../../core/modules/module-catalog';
import { activeModuleIndex, rotationTowards } from '../../core/modules/module-wheel';
import { ModulePicker } from './module-picker/module-picker';
import { ModuleSpotlight } from './module-spotlight/module-spotlight';
import { ModuleWheelNav } from './module-wheel-nav/module-wheel-nav';

/** Home screen: a wheel of modules where the one facing up is highlighted and can be opened. */
@Component({
  selector: 'app-home',
  imports: [AppHeader, ModuleSpotlight, ModuleWheelNav, ModulePicker],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  protected readonly modules = APP_MODULES;
  /** Unbounded step count; wrapped only when reading the active module. */
  protected readonly rotation = signal(0);
  protected readonly isPickerOpen = signal(false);
  protected readonly activeIndex = computed(() =>
    activeModuleIndex(this.rotation(), this.modules.length),
  );
  protected readonly activeModule = computed(() => this.modules[this.activeIndex()]);
  protected readonly accentRgb = computed(() => accentRgbVariable(this.activeModule().accent));

  protected rotateBy(steps: number): void {
    this.rotation.update((rotation) => rotation + steps);
  }

  protected pickModule(index: number): void {
    this.rotation.update((rotation) => rotationTowards(rotation, index, this.modules.length));
    this.closePicker();
  }

  protected openPicker(): void {
    this.isPickerOpen.set(true);
  }

  protected closePicker(): void {
    this.isPickerOpen.set(false);
  }
}
