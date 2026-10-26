import { TestBed } from '@angular/core/testing';
import { ModuleIcon } from './module-icon';

function renderIcon(kind: string, size: number): SVGElement {
  const fixture = TestBed.createComponent(ModuleIcon);
  fixture.componentRef.setInput('kind', kind);
  fixture.componentRef.setInput('size', size);
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).querySelector('svg') as SVGElement;
}

describe('ModuleIcon', () => {
  it('draws the target glyph for routines', () => {
    const svg = renderIcon('routines', 26);

    expect(svg.querySelectorAll('circle')).toHaveLength(3);
  });

  it('draws the wallet glyph for finances', () => {
    const svg = renderIcon('finances', 26);

    expect(svg.querySelector('rect')).not.toBeNull();
  });

  it('draws the plus glyph smaller for upcoming modules', () => {
    const svg = renderIcon('upcoming', 26);

    expect(svg.getAttribute('width')).toBe('22');
  });
});
