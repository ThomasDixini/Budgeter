import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Login } from './login';

describe('Login', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('says accounts are not ready yet and offers a way back to the start', () => {
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;

    expect(page.querySelector('h1')?.textContent).toBe('Sign in');
    expect(page.querySelector('.back')?.getAttribute('href')).toBe('/');
  });
});
