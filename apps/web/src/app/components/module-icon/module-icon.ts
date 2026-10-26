import { Component, computed, input } from '@angular/core';
import { ModuleKind } from '../../core/modules/app-module';

/** The "coming soon" plus glyph is drawn smaller so it reads at the same weight as the others. */
const UPCOMING_ICON_SCALE = 0.85;

/** Stroke icon that represents a module; inherits `currentColor`. */
@Component({
  selector: 'app-module-icon',
  template: `<svg
    [attr.width]="renderedSize()"
    [attr.height]="renderedSize()"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    [attr.stroke-width]="strokeWidth()"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    @switch (kind()) {
      @case ('routines') {
        <circle cx="12" cy="12" r="9"></circle>
        <circle cx="12" cy="12" r="5"></circle>
        <circle cx="12" cy="12" r="1.2"></circle>
        <path d="M21 3l-6.5 6.5"></path>
      }
      @case ('finances') {
        <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18v4"></path>
        <rect x="3" y="7" width="18" height="13" rx="2.5"></rect>
        <path d="M16 13.5h2"></path>
      }
      @default {
        <path d="M12 6v12M6 12h12"></path>
      }
    }
  </svg>`,
  styles: ':host { display: inline-flex; }',
})
export class ModuleIcon {
  readonly kind = input.required<ModuleKind>();
  readonly size = input(24);
  readonly strokeWidth = input(1.6);

  protected readonly renderedSize = computed(() =>
    this.kind() === 'upcoming' ? Math.round(this.size() * UPCOMING_ICON_SCALE) : this.size(),
  );
}
