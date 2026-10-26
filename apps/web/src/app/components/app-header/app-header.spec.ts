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
});
