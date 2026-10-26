import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppModule } from '../../../core/modules/app-module';
import { APP_MODULES } from '../../../core/modules/module-catalog';
import { ModuleSpotlight } from './module-spotlight';

function renderSpotlight(module: AppModule): HTMLElement {
  const fixture = TestBed.createComponent(ModuleSpotlight);
  fixture.componentRef.setInput('module', module);
  fixture.componentRef.setInput('position', 2);
  fixture.componentRef.setInput('total', 4);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ModuleSpotlight', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('shows the module name as the page title', () => {
    const element = renderSpotlight(APP_MODULES[1]);

    expect(element.querySelector('h1')?.textContent).toBe('Finances');
  });

  it('shows the module position on the wheel', () => {
    const element = renderSpotlight(APP_MODULES[1]);

    expect(element.querySelector('.counter')?.textContent).toBe('Module 2 of 4');
  });

  it('links to the module when it is available', () => {
    const element = renderSpotlight(APP_MODULES[1]);

    expect(element.querySelector('.open-link')?.getAttribute('href')).toBe('/finances');
  });

  it('hides the open link for a coming-soon module', () => {
    const element = renderSpotlight(APP_MODULES[2]);

    expect(element.querySelector('.open-link')).toBeNull();
  });
});
