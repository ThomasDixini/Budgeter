import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppModule, isModuleAvailable } from '../../../core/modules/app-module';
import { ModuleIcon } from '../../../components/module-icon/module-icon';

/** Hero of the home screen: glowing orb, name and description of the module facing up. */
@Component({
  selector: 'app-module-spotlight',
  imports: [RouterLink, ModuleIcon],
  template: `<section class="spotlight" aria-live="polite">
    <div class="orb" aria-hidden="true">
      <app-module-icon [kind]="module().kind" [size]="72" [strokeWidth]="1.2" />
    </div>
    <p class="counter">Module {{ position() }} of {{ total() }}</p>
    <h1 class="title">{{ module().name }}</h1>
    <p class="description">{{ module().description }}</p>
    @if (route(); as route) {
      <a class="open-link" [routerLink]="route">Open module</a>
    }
  </section>`,
  styleUrl: './module-spotlight.css',
})
export class ModuleSpotlight {
  readonly module = input.required<AppModule>();
  readonly position = input.required<number>();
  readonly total = input.required<number>();

  protected readonly route = computed(() =>
    isModuleAvailable(this.module()) ? this.module().route : undefined,
  );
}
