import { Component, input } from '@angular/core';

/** The line across the Today timeline that marks the current time, with a dot and the time itself. */
@Component({
  selector: 'app-now-line',
  template: `<span class="now-dot"></span> <span class="now-label ui-tabular">{{ label() }}</span>`,
  styleUrl: './now-line.css',
  host: { 'aria-hidden': 'true', '[style.top.px]': 'offset()' },
})
export class NowLine {
  /** Pixels from the top of the timeline. */
  readonly offset = input.required<number>();
  /** The time shown beside the line, e.g. "14:10". */
  readonly label = input.required<string>();
}
