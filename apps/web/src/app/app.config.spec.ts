import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { appConfig } from './app.config';
import { routes } from './app.routes';

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
  it('starts with no routes defined', () => {
    expect(routes).toEqual([]);
  });

  it('is wired into the application config', () => {
    expect(appConfig.providers).toContainEqual(provideRouter(routes));
  });
});
