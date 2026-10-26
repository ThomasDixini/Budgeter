import { ComponentFixture, TestBed } from '@angular/core/testing';
import { APP_MODULES } from '../../../core/modules/module-catalog';
import { ModuleWheelNav } from './module-wheel-nav';

function createWheel(rotation: number): ComponentFixture<ModuleWheelNav> {
  const fixture = TestBed.createComponent(ModuleWheelNav);
  fixture.componentRef.setInput('modules', APP_MODULES);
  fixture.componentRef.setInput('rotation', rotation);
  fixture.detectChanges();
  return fixture;
}

function click(fixture: ComponentFixture<ModuleWheelNav>, selector: string): void {
  (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(selector)?.click();
}

describe('ModuleWheelNav', () => {
  it('spins one step back from the left half', () => {
    const fixture = createWheel(0);
    const steps: number[] = [];
    fixture.componentInstance.rotate.subscribe((step) => steps.push(step));

    click(fixture, '.half-left');

    expect(steps).toEqual([-1]);
  });

  it('spins one step forward from the right half', () => {
    const fixture = createWheel(0);
    const steps: number[] = [];
    fixture.componentInstance.rotate.subscribe((step) => steps.push(step));

    click(fixture, '.half-right');

    expect(steps).toEqual([1]);
  });

  it('asks to open the picker from the all-modules button', () => {
    const fixture = createWheel(0);
    let opened = false;
    fixture.componentInstance.openPicker.subscribe(() => (opened = true));

    click(fixture, '.all-modules');

    expect(opened).toBe(true);
  });

  it('names the module facing up', () => {
    const fixture = createWheel(1);

    const name = (fixture.nativeElement as HTMLElement).querySelector('.active-name');

    expect(name?.textContent).toBe('Finances');
  });

  it('draws one slot per wheel position', () => {
    const fixture = createWheel(0);

    const slots = (fixture.nativeElement as HTMLElement).querySelectorAll('.slot');

    expect(slots.length).toBe(8);
  });
});
