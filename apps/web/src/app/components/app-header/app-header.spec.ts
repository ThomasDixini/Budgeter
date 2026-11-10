import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { fakeSession } from '../../core/auth/fake-auth-gateway';
import { SessionStore } from '../../core/auth/session-store';
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

  describe('when someone is signed in', () => {
    beforeEach(() => TestBed.inject(SessionStore).start(fakeSession('Ana'), false));
    afterEach(() => TestBed.inject(SessionStore).end());

    it('offers a labelled sign-out button naming the person', () => {
      const fixture = TestBed.createComponent(AppHeader);
      fixture.detectChanges();

      const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
        '.profile',
      );

      expect([button?.getAttribute('aria-label'), button?.title]).toEqual([
        'Sign out',
        'Ana · Sign out',
      ]);
    });

    it('signs out and returns to the landing page', async () => {
      const router = TestBed.inject(Router);
      const navigation = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
      const fixture = TestBed.createComponent(AppHeader);
      fixture.detectChanges();

      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.profile')?.click();

      expect(TestBed.inject(SessionStore).isSignedIn()).toBe(false);
      expect(navigation).toHaveBeenCalledWith('/');
    });
  });

  it('has no sign-out button when no one is signed in', () => {
    const fixture = TestBed.createComponent(AppHeader);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.profile')).toBeNull();
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
