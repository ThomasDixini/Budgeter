import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { APP_MODULES } from '../../core/modules/module-catalog';
import { ModuleDock } from './module-dock';

function renderDock(): HTMLElement {
  const fixture = TestBed.createComponent(ModuleDock);
  fixture.componentRef.setInput('current', APP_MODULES[0]);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ModuleDock', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('marks the current module', () => {
    const element = renderDock();

    expect(element.querySelector('[aria-current="page"]')?.getAttribute('title')).toBe(
      'Routines & Goals',
    );
  });

  it('wraps around the wheel for the previous module', () => {
    const element = renderDock();

    expect(element.querySelector('.neighbour-previous')?.getAttribute('aria-label')).toBe(
      'Previous module: Coming soon',
    );
  });

  it('links the next module back to the wheel', () => {
    const next = renderDock().querySelector('.neighbour-next');

    expect(next?.getAttribute('aria-label')).toBe('Next module: Finances');
    expect(next?.getAttribute('href')).toBe('/');
  });
});
