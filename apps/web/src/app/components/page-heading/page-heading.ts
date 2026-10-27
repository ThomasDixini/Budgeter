import { Component, input } from '@angular/core';
import { ModuleKind } from '../../core/modules/app-module';
import { ModuleIcon } from '../module-icon/module-icon';

/** Title block at the top of a module page; projected content becomes the page actions. */
@Component({
  selector: 'app-page-heading',
  imports: [ModuleIcon],
  template: `<header class="page-heading">
    <div class="text">
      <p class="ui-eyebrow">
        @if (eyebrowIcon(); as icon) {
          <app-module-icon [kind]="icon" [size]="16" />
        }
        {{ eyebrow() }}
      </p>
      <h1 class="ui-page-title">{{ heading() }}</h1>
      @if (description(); as description) {
        <p class="description">{{ description }}</p>
      }
    </div>
    <div class="actions"><ng-content /></div>
  </header>`,
  styleUrl: './page-heading.css',
})
export class PageHeading {
  readonly eyebrow = input.required<string>();
  readonly heading = input.required<string>();
  readonly description = input<string>();
  readonly eyebrowIcon = input<ModuleKind>();
}
