import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterOutlet } from '@angular/router';
import { App } from './app';
import { Sidebar } from './components/sidebar/sidebar';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  template: '',
})
class MockSidebar {}

describe('App', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    })
      .overrideComponent(App, {
        remove: { imports: [Sidebar, RouterOutlet] },
        add: { imports: [MockSidebar, RouterOutlet] },
      })
      .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
