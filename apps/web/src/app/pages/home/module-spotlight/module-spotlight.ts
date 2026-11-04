import { Component, computed, inject, input } from '@angular/core';
import { Translator } from '../../../core/i18n/translator';
import { RouterLink } from '@angular/router';
import { AppModule, isModuleAvailable } from '../../../core/modules/app-module';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ModuleIcon } from '../../../components/module-icon/module-icon';

/** Hero of the home screen: glowing orb, name and description of the module facing up. */
@Component({
  selector: 'app-module-spotlight',
  imports: [RouterLink, ModuleIcon, TranslatePipe],
  template: `<section class="spotlight" aria-live="polite">
    <div class="orb" aria-hidden="true">
      <app-module-icon [kind]="module().kind" [size]="72" [strokeWidth]="1.2" />
    </div>
    <p class="counter">{{ counter() }}</p>
    <h1 class="title">{{ module().name | t }}</h1>
    <p class="description">{{ module().description | t }}</p>
    @if (route(); as route) {
      <a class="open-link" [routerLink]="route">{{ 'Open module' | t }}</a>
    }
  </section>`,
  styleUrl: './module-spotlight.css',
})
export class ModuleSpotlight {
  readonly module = input.required<AppModule>();
  readonly position = input.required<number>();
  readonly total = input.required<number>();

  private readonly translator = inject(Translator);

  protected readonly counter = computed(() =>
    this.translator.translate('Module {position} of {total}', {
      position: this.position(),
      total: this.total(),
    }),
  );
  protected readonly route = computed(() =>
    isModuleAvailable(this.module()) ? this.module().route : undefined,
  );
}
