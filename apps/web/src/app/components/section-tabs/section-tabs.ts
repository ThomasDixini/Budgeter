import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ModuleSection } from '../../core/modules/module-section';

/** Pill-shaped section switcher shown in the header of every module page. */
@Component({
  selector: 'app-section-tabs',
  imports: [RouterLink, RouterLinkActive],
  template: `<nav class="tabs" aria-label="Module sections">
    @for (section of sections(); track section.path) {
      <a
        class="tab"
        [routerLink]="section.path"
        routerLinkActive="is-active"
        [routerLinkActiveOptions]="{ exact: !section.matchesChildren }"
        ariaCurrentWhenActive="page"
        >{{ section.label }}</a
      >
    }
  </nav>`,
  styleUrl: './section-tabs.css',
})
export class SectionTabs {
  readonly sections = input.required<readonly ModuleSection[]>();
}
