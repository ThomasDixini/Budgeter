import { Component, computed, input, output } from '@angular/core';
import { AppModule, accentRgbVariable } from '../../../core/modules/app-module';
import { buildWheelSlots, wheelSpinDegrees } from '../../../core/modules/module-wheel';
import { ModuleIcon } from '../../../components/module-icon/module-icon';

/** Glass dome at the bottom of the home screen; each half spins the module wheel one step. */
@Component({
  selector: 'app-module-wheel-nav',
  imports: [ModuleIcon],
  templateUrl: './module-wheel-nav.html',
  styleUrl: './module-wheel-nav.css',
})
export class ModuleWheelNav {
  readonly modules = input.required<readonly AppModule[]>();
  readonly rotation = input.required<number>();
  readonly isPickerOpen = input(false);
  readonly rotate = output<number>();
  readonly openPicker = output();

  protected readonly slots = computed(() => buildWheelSlots(this.rotation(), this.modules()));
  protected readonly spin = computed(() =>
    wheelSpinDegrees(this.rotation(), this.modules().length),
  );
  protected readonly activeName = computed(
    () => this.slots().find((slot) => slot.isActive)?.module.name ?? '',
  );
  protected readonly accentRgbVariable = accentRgbVariable;
}
