import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { appConfig } from './app.config';
import { routes } from './app.routes';
import { APP_MODULES } from './core/modules/module-catalog';
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

  // Regression: Finances linked to /finances, which no route served, so "Open module" led back home.
  it('serves the page of every module the home wheel links to', () => {
    const linked = APP_MODULES.flatMap((module) =>
      module.route === undefined ? [] : [module.route],
    );
    const served = routes.map((route) => `/${route.path}`);

    expect(linked.filter((route) => !served.includes(route))).toEqual([]);
  });
});
