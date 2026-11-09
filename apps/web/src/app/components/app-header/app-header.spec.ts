import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideFakeBackupGateway } from '../../core/backups/fake-backup-gateway';
import { DEMO_STORAGE_KEY } from '../../core/finances/demo/demo-mode';
import { AppHeader } from './app-header';

describe('AppHeader', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideFakeBackupGateway()] });
  });

  it('links the brand back to the home screen', () => {
    const fixture = TestBed.createComponent(AppHeader);
    fixture.detectChanges();

    const brand = (fixture.nativeElement as HTMLElement).querySelector('.brand');

    expect(brand?.getAttribute('href')).toBe('/');
  });

  it('offers a labelled profile button', () => {
    const fixture = TestBed.createComponent(AppHeader);
    fixture.detectChanges();

    const profile = (fixture.nativeElement as HTMLElement).querySelector('.profile');

    expect(profile?.getAttribute('aria-label')).toBe('Profile');
  });

  // The button leads nowhere yet (there are no accounts), so it must not look clickable.
  it('keeps the profile button disabled until accounts exist', () => {
    const fixture = TestBed.createComponent(AppHeader);
    fixture.detectChanges();

    const profile = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '.profile',
    );

    expect([profile?.disabled, profile?.title]).toEqual([true, 'Coming soon']);
  });

  it('offers the backup of the data', () => {
    const fixture = TestBed.createComponent(AppHeader);
    fixture.detectChanges();

    const backup = (fixture.nativeElement as HTMLElement).querySelector('app-backup-menu');

    expect(backup).not.toBeNull();
  });

  // A backup always holds the person's own data, which the demo is hiding.
  it('hides the backup while the demo data shows', () => {
    localStorage.setItem(DEMO_STORAGE_KEY, 'on');
    const fixture = TestBed.createComponent(AppHeader);
    fixture.detectChanges();
    localStorage.removeItem(DEMO_STORAGE_KEY);

    const backup = (fixture.nativeElement as HTMLElement).querySelector('app-backup-menu');

    expect(backup).toBeNull();
  });
});
