import { ComponentFixture, TestBed } from '@angular/core/testing';
import { APP_MODULES } from '../../../core/modules/module-catalog';
import { ModulePicker } from './module-picker';

function createPicker(): ComponentFixture<ModulePicker> {
  const fixture = TestBed.createComponent(ModulePicker);
  fixture.componentRef.setInput('modules', APP_MODULES);
  fixture.componentRef.setInput('activeIndex', 1);
  fixture.detectChanges();
  return fixture;
}

function options(fixture: ComponentFixture<ModulePicker>): HTMLButtonElement[] {
  return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.option'));
}

describe('ModulePicker', () => {
  it('lists every module', () => {
    const fixture = createPicker();

    expect(options(fixture).length).toBe(APP_MODULES.length);
  });

  it('marks the active module as current', () => {
    const fixture = createPicker();

    expect(options(fixture)[1].getAttribute('aria-current')).toBe('true');
  });

  it('emits the index of the picked module', () => {
    const fixture = createPicker();
    const picked: number[] = [];
    fixture.componentInstance.pick.subscribe((index) => picked.push(index));

    options(fixture)[3].click();

    expect(picked).toEqual([3]);
  });

  it('dismisses from the close button', () => {
    const fixture = createPicker();
    let dismissed = false;
    fixture.componentInstance.dismiss.subscribe(() => (dismissed = true));

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.close')?.click();

    expect(dismissed).toBe(true);
  });

  it('dismisses on Escape', () => {
    const fixture = createPicker();
    let dismissed = false;
    fixture.componentInstance.dismiss.subscribe(() => (dismissed = true));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(dismissed).toBe(true);
  });
});
