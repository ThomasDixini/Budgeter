import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { isDemoMode, setDemoMode } from '../../core/finances/demo/demo-mode';
import { PageReloader } from '../../core/i18n/page-reloader';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

/**
 * A button in the header that swaps the Finances screens between the person's own data and made-up demo
 * data. The page starts again for the change to apply, as the data sources are chosen when the app starts.
 */
@Component({
  selector: 'app-demo-switch',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button
    class="demo"
    type="button"
    [attr.aria-pressed]="isOn"
    [title]="
      (isOn ? 'Showing made-up Finances data. Click to use yours.' : 'Show made-up Finances data')
        | t
    "
    (click)="toggle()"
  >
    {{ 'Demo' | t }}
  </button>`,
  styleUrl: './demo-switch.css',
})
export class DemoSwitch {
  private readonly reloader = inject(PageReloader);

  protected readonly isOn = isDemoMode();

  protected toggle(): void {
    setDemoMode(!this.isOn);
    this.reloader.reload();
  }
}
