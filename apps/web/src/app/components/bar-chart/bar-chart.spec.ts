import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BarChart } from './bar-chart';

function render(inputs: { selectable?: boolean; selectedIndex?: number | undefined } = {}): {
  fixture: ComponentFixture<BarChart>;
  picked: number[];
} {
  const fixture = TestBed.createComponent(BarChart);
  fixture.componentRef.setInput('title', 'Gains');
  fixture.componentRef.setInput('labels', ['Sep', 'Oct', 'Nov']);
  fixture.componentRef.setInput('values', [100, -50, 200]);
  fixture.componentRef.setInput('format', (value: number) => String(value));
  fixture.componentRef.setInput('emptyText', 'Nothing');
  fixture.componentRef.setInput('selectable', inputs.selectable ?? false);
  fixture.componentRef.setInput('selectedIndex', inputs.selectedIndex);
  const picked: number[] = [];
  fixture.componentInstance.pick.subscribe((index) => picked.push(index));
  fixture.detectChanges();
  return { fixture, picked };
}

function element(fixture: ComponentFixture<BarChart>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

describe('BarChart', () => {
  it('draws one bar per value, the negative one in the second color', () => {
    const { fixture } = render();

    expect(
      [...element(fixture).querySelectorAll('.bar')].map((bar) =>
        bar.classList.contains('negative'),
      ),
    ).toEqual([false, true, false]);
  });

  it('cannot be picked unless it is selectable', () => {
    const { fixture } = render();

    expect(element(fixture).querySelectorAll('.hit').length).toBe(0);
  });

  it('reports the bar clicked or confirmed with the keyboard', () => {
    const { fixture, picked } = render({ selectable: true });
    const hits = element(fixture).querySelectorAll<SVGRectElement>('.hit');

    hits[1].dispatchEvent(new Event('click'));
    hits[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    hits[0].dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));

    expect(picked).toEqual([1, 2, 0]);
  });

  it('fades the bars that are not the one picked and marks the picked one as pressed', () => {
    const { fixture } = render({ selectable: true, selectedIndex: 1 });

    expect([
      [...element(fixture).querySelectorAll('.bar')].map((bar) => bar.classList.contains('dimmed')),
      [...element(fixture).querySelectorAll('.hit')].map((hit) => hit.getAttribute('aria-pressed')),
    ]).toEqual([
      [true, false, true],
      ['false', 'true', 'false'],
    ]);
  });
});
