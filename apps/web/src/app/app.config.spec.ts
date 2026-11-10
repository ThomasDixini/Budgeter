import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { appConfig } from './app.config';
import { routes } from './app.routes';
import { APP_MODULES } from './core/modules/module-catalog';
import { Landing } from './pages/landing/landing';
import { Login } from './pages/login/login';

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

  it('gives the router the application routes', () => {
    expect(TestBed.inject(Router).config.map((route) => route.path)).toEqual(
      routes.map((route) => route.path),
    );
  });
});

describe('routes', () => {
  it('serves the landing page at the root path', () => {
    expect(routes.find((route) => route.path === '')?.component).toBe(Landing);
  });

  it('has no /modules route', () => {
    expect(routes.some((route) => route.path === 'modules')).toBe(false);
  });

  it('serves the sign-in placeholder at /login', () => {
    expect(routes.find((route) => route.path === 'login')?.component).toBe(Login);
  });

  it('redirects unknown paths to the landing page', () => {
    expect(routes.find((route) => route.path === '**')?.redirectTo).toBe('');
  });

  // Regression: Finances linked to /finances, which no route served, so "Open module" led back home.
  it('serves the page of every module the home wheel links to', () => {
    const linked = APP_MODULES.flatMap((module) =>
      module.route === undefined ? [] : [module.route],
    );
    const served = routes.map((route) => `/${route.path}`);

    expect(linked.filter((route) => !served.includes(route))).toEqual([]);
  });
});
