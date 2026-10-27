import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ROUTINES_SECTIONS } from '../../../core/routines/routines-section';

/** Pill-shaped section switcher shown in the header of every Routines & Goals page. */
@Component({
  selector: 'app-routines-tabs',
  imports: [RouterLink, RouterLinkActive],
  template: `<nav class="tabs" aria-label="Module sections">
    @for (section of sections; track section.path) {
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
  styleUrl: './routines-tabs.css',
})
export class RoutinesTabs {
  protected readonly sections = ROUTINES_SECTIONS;
}
