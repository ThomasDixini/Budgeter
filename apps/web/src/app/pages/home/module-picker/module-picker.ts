import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';
import { AppModule, accentRgbVariable } from '../../../core/modules/app-module';
import { ModuleIcon } from '../../../components/module-icon/module-icon';

const FULL_TURN_DEGREES = 360;

interface PickerOption {
  readonly module: AppModule;
  readonly index: number;
  readonly angle: number;
  readonly isActive: boolean;
}

/** Full-screen ring that lists every module at once; picking one spins the wheel to it. */
@Component({
  selector: 'app-module-picker',
  imports: [ModuleIcon],
  templateUrl: './module-picker.html',
  styleUrl: './module-picker.css',
  host: { '(document:keydown.escape)': 'dismiss.emit()' },
})
export class ModulePicker {
  readonly modules = input.required<readonly AppModule[]>();
  readonly activeIndex = input.required<number>();
  readonly pick = output<number>();
  readonly dismiss = output();

  private readonly closeButton = viewChild.required<ElementRef<HTMLButtonElement>>('closeButton');

  protected readonly options = computed(() =>
    this.modules().map((module, index) => this.toOption(module, index)),
  );
  protected readonly accentRgbVariable = accentRgbVariable;

  constructor() {
    afterNextRender(() => this.closeButton().nativeElement.focus());
  }

  private toOption(module: AppModule, index: number): PickerOption {
    return {
      module,
      index,
      angle: index * (FULL_TURN_DEGREES / this.modules().length),
      isActive: index === this.activeIndex(),
    };
  }
}
