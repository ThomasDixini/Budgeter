import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NowLine } from './now-line';

function createLine(offset: number, label: string): ComponentFixture<NowLine> {
  const fixture = TestBed.createComponent(NowLine);
  fixture.componentRef.setInput('offset', offset);
  fixture.componentRef.setInput('label', label);
  fixture.detectChanges();
  return fixture;
}

describe('NowLine', () => {
  it('shows the time beside the line', () => {
    const fixture = createLine(296, '14:10');

    expect((fixture.nativeElement as HTMLElement).querySelector('.now-label')?.textContent).toBe(
      '14:10',
    );
  });

  it('sits at the given distance from the top of the timeline', () => {
    const fixture = createLine(296, '14:10');

    expect((fixture.nativeElement as HTMLElement).style.top).toBe('296px');
  });

  it('is left out of the accessibility tree: the Now card says the same in words', () => {
    const fixture = createLine(296, '14:10');

    expect((fixture.nativeElement as HTMLElement).getAttribute('aria-hidden')).toBe('true');
  });
});
