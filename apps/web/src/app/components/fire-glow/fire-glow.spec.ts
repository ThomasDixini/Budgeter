import { TestBed } from '@angular/core/testing';
import { FireGlow } from './fire-glow';

function renderFireGlow(): HTMLElement {
  const fixture = TestBed.createComponent(FireGlow);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('FireGlow', () => {
  it('draws on a canvas', () => {
    expect(renderFireGlow().querySelector('canvas')).not.toBeNull();
  });

  it('is hidden from assistive technology', () => {
    expect(renderFireGlow().getAttribute('aria-hidden')).toBe('true');
  });
});
