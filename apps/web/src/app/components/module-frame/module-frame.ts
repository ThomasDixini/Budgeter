import { Component, computed, input } from '@angular/core';
import { AppModule, accentVariable } from '../../core/modules/app-module';
import { ModuleSection } from '../../core/modules/module-section';
import { AppHeader } from '../app-header/app-header';
import { FireGlow } from '../fire-glow/fire-glow';
import { ModuleDock } from '../module-dock/module-dock';
import { SectionTabs } from '../section-tabs/section-tabs';

/**
 * Frame shared by every module page: header with the module's section tabs, the projected page and
 * the module dock. It tints the page with the module accent through `--color-accent`.
 */
@Component({
  selector: 'app-module-frame',
  imports: [AppHeader, FireGlow, ModuleDock, SectionTabs],
  template: `<div class="shell" [style.--color-accent]="accent()">
    <app-fire-glow class="fire" />
    <app-header>
      <app-section-tabs class="tabs" [sections]="sections()" />
    </app-header>
    <main class="content">
      <ng-content />
    </main>
    <app-module-dock [current]="module()" />
  </div>`,
  styleUrl: './module-frame.css',
})
export class ModuleFrame {
  readonly module = input.required<AppModule>();
  readonly sections = input.required<readonly ModuleSection[]>();

  protected readonly accent = computed(() => accentVariable(this.module().accent));
}
