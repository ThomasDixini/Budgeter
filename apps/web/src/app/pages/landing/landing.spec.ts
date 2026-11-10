import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Landing } from './landing';

function createLanding(): ComponentFixture<Landing> {
  const fixture = TestBed.createComponent(Landing);
  fixture.detectChanges();
  return fixture;
}

function page(fixture: ComponentFixture<Landing>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function click(fixture: ComponentFixture<Landing>, selector: string): void {
  const button = page(fixture).querySelector<HTMLButtonElement>(selector);
  if (button === null) throw new Error(`Expected an element matching ${selector}, found none`);
  button.click();
  fixture.detectChanges();
}

describe('Landing', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('presents the project in a single heading', () => {
    const headings = page(createLanding()).querySelectorAll('h1');

    expect(headings.length).toBe(1);
    expect(headings[0].textContent).toContain('Your routine');
  });

  it('leads to the sign-in from the top bar, the hero, the closing section and the footer', () => {
    const links = page(createLanding()).querySelectorAll('a[href="/login"]');

    expect(links.length).toBe(4);
  });

  it('has no link to a module wheel route', () => {
    const hrefs = Array.from(page(createLanding()).querySelectorAll('a'), (a) =>
      a.getAttribute('href'),
    );

    expect(hrefs).not.toContain('/modules');
  });

  it('starts the wheel on the routines module, which can be opened', () => {
    const fixture = createLanding();

    expect(page(fixture).querySelector('.module-name')?.textContent).toBe('Routines & Goals');
    expect(page(fixture).querySelector('.open-module')?.getAttribute('href')).toBe('/routines');
  });

  it('moves to Finances when the wheel spins right', () => {
    const fixture = createLanding();

    click(fixture, '.half-right');

    expect(page(fixture).querySelector('.module-name')?.textContent).toBe('Finances');
    expect(page(fixture).querySelector('.open-module')?.getAttribute('href')).toBe('/finances');
  });

  it('offers no open link for a module that is not built yet', () => {
    const fixture = createLanding();

    click(fixture, '.half-left');

    expect(page(fixture).querySelector('.module-name')?.textContent).toBe('Coming soon');
    expect(page(fixture).querySelector('.open-module')).toBeNull();
  });

  it('lists every feature of the first version', () => {
    expect(page(createLanding()).querySelectorAll('.feature').length).toBe(9);
  });
});
