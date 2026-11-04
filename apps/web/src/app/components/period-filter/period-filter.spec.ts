import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Period } from '../../core/finances/period';
import { PeriodFilter } from './period-filter';

const TODAY = '2026-11-03';

function render(
  period: Period,
  shortLabels = false,
): { fixture: ComponentFixture<PeriodFilter>; changes: Period[] } {
  const fixture = TestBed.createComponent(PeriodFilter);
  fixture.componentRef.setInput('period', period);
  fixture.componentRef.setInput('today', TODAY);
  fixture.componentRef.setInput('shortLabels', shortLabels);
  const changes: Period[] = [];
  fixture.componentInstance.periodChange.subscribe((next) => changes.push(next));
  fixture.detectChanges();
  return { fixture, changes };
}

function element(fixture: ComponentFixture<PeriodFilter>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function click(fixture: ComponentFixture<PeriodFilter>, label: string): void {
  [...element(fixture).querySelectorAll('button')]
    .find((button) => button.textContent?.trim() === label)!
    .click();
  fixture.detectChanges();
}

function type(fixture: ComponentFixture<PeriodFilter>, name: string, value: string): void {
  const input = element(fixture).querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
  input.value = value;
  input.dispatchEvent(new Event('change'));
  fixture.detectChanges();
}

describe('PeriodFilter', () => {
  it('offers the presets and marks the one in use', () => {
    const { fixture } = render({ kind: 'months', months: 6 });

    expect(
      [...element(fixture).querySelectorAll('button')].map((button) => [
        button.textContent?.trim(),
        button.getAttribute('aria-pressed'),
      ]),
    ).toEqual([
      ['3 months', 'false'],
      ['6 months', 'true'],
      ['12 months', 'false'],
      ['Custom', 'false'],
    ]);
  });

  it('can write the presets short', () => {
    const { fixture } = render({ kind: 'months', months: 3 }, true);

    expect(
      [...element(fixture).querySelectorAll('button')].map((button) => button.textContent?.trim()),
    ).toEqual(['3M', '6M', '12M', 'Custom']);
  });

  it('switches to a custom period that starts from the days of the preset', () => {
    const { fixture, changes } = render({ kind: 'months', months: 3 });

    click(fixture, 'Custom');

    expect(changes).toEqual([{ kind: 'custom', from: '2026-09-01', to: TODAY }]);
  });

  it('shows the days of a custom period and reports a new start', () => {
    const { fixture, changes } = render({ kind: 'custom', from: '2026-08-15', to: '2026-10-02' });

    type(fixture, 'from', '2026-08-01');

    expect([
      element(fixture).querySelector<HTMLInputElement>('input[name="to"]')!.value,
      changes,
    ]).toEqual(['2026-10-02', [{ kind: 'custom', from: '2026-08-01', to: '2026-10-02' }]]);
  });

  it('says why days are refused and reports nothing', () => {
    const { fixture, changes } = render({ kind: 'custom', from: '2026-08-15', to: '2026-10-02' });

    type(fixture, 'from', '2026-12-01');

    expect([element(fixture).querySelector('.error')?.textContent?.trim(), changes]).toEqual([
      'Pick a start day that is not after the end, within 10 years.',
      [],
    ]);
  });

  it('goes back to a preset', () => {
    const { fixture, changes } = render({ kind: 'custom', from: '2026-08-15', to: '2026-10-02' });

    click(fixture, '12 months');

    expect(changes).toEqual([{ kind: 'months', months: 12 }]);
  });
});
