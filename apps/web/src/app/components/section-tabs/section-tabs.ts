import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ModuleSection } from '../../core/modules/module-section';

/** Pill-shaped section switcher shown in the header of every module page. */
@Component({
  selector: 'app-section-tabs',
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  template: `<nav class="tabs" [attr.aria-label]="'Module sections' | t">
    @for (section of sections(); track section.path) {
      <a
        class="tab"
        [routerLink]="section.path"
        routerLinkActive="is-active"
        [routerLinkActiveOptions]="{ exact: !section.matchesChildren }"
        ariaCurrentWhenActive="page"
        >{{ section.label | t }}</a
      >
    }
  </nav>`,
  styleUrl: './section-tabs.css',
})
export class SectionTabs {
  readonly sections = input.required<readonly ModuleSection[]>();
}
