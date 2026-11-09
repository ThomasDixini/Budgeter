import { provideFakeBackupGateway } from '../../core/backups/fake-backup-gateway';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Home } from './home';

function createHome(): ComponentFixture<Home> {
  const fixture = TestBed.createComponent(Home);
  fixture.detectChanges();
  return fixture;
}

function query<T extends Element>(fixture: ComponentFixture<Home>, selector: string): T | null {
  return (fixture.nativeElement as HTMLElement).querySelector<T>(selector);
}

/**
 * Clicks the button matching `selector`, failing the test when there is none: with `?.` a missing
 * button was silently not clicked, and the test checking that the picker closed passed anyway.
 */
function clickAndRender(fixture: ComponentFixture<Home>, selector: string): void {
  const button = query<HTMLButtonElement>(fixture, selector);
  if (button === null) throw new Error(`Expected a button matching ${selector}, found none`);
  button.click();
  fixture.detectChanges();
}

describe('Home', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideFakeBackupGateway()] });
  });

  it('starts on the routines module', () => {
    const fixture = createHome();

    expect(query(fixture, 'h1')?.textContent).toBe('Routines & Goals');
  });

  it('moves to the next module when the wheel spins right', () => {
    const fixture = createHome();

    clickAndRender(fixture, '.half-right');

    expect(query(fixture, 'h1')?.textContent).toBe('Finances');
  });

  it('wraps to the last module when the wheel spins left', () => {
    const fixture = createHome();

    clickAndRender(fixture, '.half-left');

    expect(query(fixture, '.counter')?.textContent).toBe('Module 4 of 4');
  });

  it('opens the module picker', () => {
    const fixture = createHome();

    clickAndRender(fixture, '.all-modules');

    expect(query(fixture, 'dialog')).not.toBeNull();
  });

  it('closes the picker once a module is picked', () => {
    const fixture = createHome();
    clickAndRender(fixture, '.all-modules');

    clickAndRender(fixture, '.option');

    expect(query(fixture, 'dialog')).toBeNull();
  });

  it('jumps to the module picked in the picker', () => {
    const fixture = createHome();
    clickAndRender(fixture, '.all-modules');

    const options = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      '.option',
    );
    options[1].click();
    fixture.detectChanges();

    expect(query(fixture, 'h1')?.textContent).toBe('Finances');
  });
});
