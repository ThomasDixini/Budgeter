import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { appConfig } from './app.config';
import { routes } from './app.routes';
import { Home } from './pages/home/home';

describe('appConfig', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...appConfig.providers, provideHttpClient(), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('exposes a router when the application config is used', () => {
    expect(TestBed.inject(Router)).toBeTruthy();
  });
});

describe('routes', () => {
  it('serves the home page at the root path', () => {
    expect(routes.find((route) => route.path === '')?.component).toBe(Home);
  });

  it('redirects unknown paths to the home page', () => {
    expect(routes.find((route) => route.path === '**')?.redirectTo).toBe('');
  });

  it('is wired into the application config', () => {
    expect(appConfig.providers).toContainEqual(provideRouter(routes));
  });
});
