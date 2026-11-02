import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppHeader } from './app-header';

describe('AppHeader', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
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
});
