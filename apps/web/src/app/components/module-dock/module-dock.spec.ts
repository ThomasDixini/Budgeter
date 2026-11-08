import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppModule } from '../../core/modules/app-module';
import { APP_MODULES } from '../../core/modules/module-catalog';
import { ModuleDock } from './module-dock';

const ROUTINES = APP_MODULES[0];
const FINANCES = APP_MODULES[1];

function renderDock(current: AppModule = ROUTINES): HTMLElement {
  const fixture = TestBed.createComponent(ModuleDock);
  fixture.componentRef.setInput('current', current);
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

  it('opens the next module directly instead of going back to the wheel', () => {
    const next = renderDock().querySelector('.neighbour-next');

    expect(next?.getAttribute('aria-label')).toBe('Next module: Finances');
    expect(next?.getAttribute('href')).toBe('/finances');
  });

  it('opens the previous module directly', () => {
    const previous = renderDock(FINANCES).querySelector('.neighbour-previous');

    expect(previous?.getAttribute('aria-label')).toBe('Previous module: Routines & Goals');
    expect(previous?.getAttribute('href')).toBe('/routines');
  });

  it('keeps a module that is not built yet on the wheel, wrapping around, but disabled', () => {
    const previous = renderDock().querySelector<HTMLButtonElement>('.neighbour-previous');

    expect([previous?.tagName, previous?.disabled, previous?.getAttribute('aria-label')]).toEqual([
      'BUTTON',
      true,
      'Previous module: Coming soon',
    ]);
  });
});
