import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserNotices } from '../../core/notices/user-notices';
import { AppNotice } from './app-notice';

function renderNotice(): ComponentFixture<AppNotice> {
  const fixture = TestBed.createComponent(AppNotice);
  fixture.detectChanges();
  return fixture;
}

function element(fixture: ComponentFixture<AppNotice>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

describe('AppNotice', () => {
  it('shows nothing while there is no message', () => {
    expect(element(renderNotice()).querySelector('[role="alert"]')).toBeNull();
  });

  it('shows the message as an alert', () => {
    const fixture = renderNotice();

    TestBed.inject(UserNotices).show("Couldn't reach the server.");
    fixture.detectChanges();

    expect(element(fixture).querySelector('[role="alert"]')?.textContent).toContain(
      "Couldn't reach the server.",
    );
  });

  it('hides the message once dismissed', () => {
    const fixture = renderNotice();
    TestBed.inject(UserNotices).show("Couldn't reach the server.");
    fixture.detectChanges();

    element(fixture).querySelector<HTMLButtonElement>('[aria-label="Dismiss"]')!.click();
    fixture.detectChanges();

    expect(element(fixture).querySelector('[role="alert"]')).toBeNull();
  });
});
