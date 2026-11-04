import { TestBed } from '@angular/core/testing';
import { DEMO_STORAGE_KEY, isDemoMode } from '../../core/finances/demo/demo-mode';
import { PageReloader } from '../../core/i18n/page-reloader';
import { DemoSwitch } from './demo-switch';

/** Counts the reloads instead of leaving the page. */
class FakePageReloader extends PageReloader {
  reloads = 0;

  override reload(): void {
    this.reloads++;
  }
}

function render(): { button: HTMLButtonElement; reloader: FakePageReloader } {
  const reloader = new FakePageReloader();
  TestBed.configureTestingModule({ providers: [{ provide: PageReloader, useValue: reloader }] });
  const fixture = TestBed.createComponent(DemoSwitch);
  fixture.detectChanges();
  return { button: (fixture.nativeElement as HTMLElement).querySelector('button')!, reloader };
}

describe('DemoSwitch', () => {
  afterEach(() => localStorage.removeItem(DEMO_STORAGE_KEY));

  it('turns the demo data on and starts the page again', () => {
    const { button, reloader } = render();

    button.click();

    expect([button.getAttribute('aria-pressed'), isDemoMode(), reloader.reloads]).toEqual([
      'false',
      true,
      1,
    ]);
  });

  it('shows that the demo is on and turns it off', () => {
    localStorage.setItem(DEMO_STORAGE_KEY, 'on');
    const { button, reloader } = render();

    button.click();

    expect([button.getAttribute('aria-pressed'), isDemoMode(), reloader.reloads]).toEqual([
      'true',
      false,
      1,
    ]);
  });
});
