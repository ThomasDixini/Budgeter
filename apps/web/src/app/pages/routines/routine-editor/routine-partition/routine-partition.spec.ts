import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Routine } from '../../../../core/routines/routine';
import { SAMPLE_CATEGORIES, SAMPLE_ROUTINES } from '../../../../core/routines/sample-routines';
import { RoutinePartition } from './routine-partition';

/** Weekdays plus a 15-minute break, too narrow on the bar for its name. */
const WITH_BREAK: Routine = {
  ...SAMPLE_ROUTINES[0],
  blocks: [
    ...SAMPLE_ROUTINES[0].blocks,
    { id: 'break', name: 'Coffee break', start: '10:00', end: '10:15' },
  ],
};

function createBar(routine: Routine = WITH_BREAK): ComponentFixture<RoutinePartition> {
  const fixture = TestBed.createComponent(RoutinePartition);
  fixture.componentRef.setInput('routine', routine);
  fixture.componentRef.setInput('categories', SAMPLE_CATEGORIES);
  fixture.detectChanges();
  return fixture;
}

function element(fixture: ComponentFixture<RoutinePartition>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function segmentNamed(fixture: ComponentFixture<RoutinePartition>, name: string): HTMLElement {
  const found = [...element(fixture).querySelectorAll<HTMLElement>('.segment')].find((segment) =>
    segment.getAttribute('aria-label')?.startsWith(`${name} ·`),
  );
  if (found === undefined) throw new Error(`Expected a segment named "${name}", found none`);
  return found;
}

describe('RoutinePartition', () => {
  it('names the blocks wide enough to fit their name', () => {
    const names = [...element(createBar()).querySelectorAll('.segment-name')].map((name) =>
      name.textContent?.trim(),
    );

    expect(names).toContain('Work');
    expect(names).not.toContain('Coffee break');
  });

  it('keeps the name, category and time of every block for screen readers', () => {
    const summaries = [...element(createBar()).querySelectorAll('.segment')].map((segment) =>
      segment.getAttribute('aria-label'),
    );

    expect(summaries).toContain('Coffee break · 10:00–10:15');
    expect(summaries).toContain('C# study · Study · 13:30–15:00');
  });

  it('names the category of the block under the mouse and points it out', () => {
    const fixture = createBar();
    const study = segmentNamed(fixture, 'C# study');

    study.dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();

    expect(element(fixture).querySelector('.tooltip-category')?.textContent?.trim()).toBe('Study');
    expect(element(fixture).querySelector('.tooltip-block')?.textContent?.trim()).toBe(
      'C# study · 13:30–15:00',
    );
    expect(
      element(fixture).querySelector('.legend-entry.is-hovered .legend-name')?.textContent,
    ).toBe('Study');
    expect(study.parentElement?.classList).toContain('is-same-category');
    expect(segmentNamed(fixture, 'Networking').parentElement?.classList).not.toContain(
      'is-same-category',
    );
  });

  it('says a block has no category, and clears it all when the mouse leaves', () => {
    const fixture = createBar();
    const breakSegment = segmentNamed(fixture, 'Coffee break');

    breakSegment.dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();
    const shown = element(fixture).querySelector('.tooltip-category')?.textContent?.trim();
    breakSegment.dispatchEvent(new Event('mouseleave'));
    fixture.detectChanges();

    expect(shown).toBe('No category');
    expect(element(fixture).querySelector('.tooltip')).toBeNull();
    expect(element(fixture).querySelector('.bar.is-pointing')).toBeNull();
  });

  // Regression: the tooltip only followed the mouse, so on a phone a block too narrow for its name
  // could never be told apart.
  it('shows a block tapped, and lets go when it is tapped again', () => {
    const fixture = createBar();
    const breakSegment = segmentNamed(fixture, 'Coffee break');

    breakSegment.click();
    fixture.detectChanges();
    const shown = element(fixture).querySelector('.tooltip-block')?.textContent?.trim();
    const isPressed = breakSegment.getAttribute('aria-pressed');
    breakSegment.click();
    fixture.detectChanges();

    expect([shown, isPressed]).toEqual(['Coffee break · 10:00–10:15', 'true']);
    expect(element(fixture).querySelector('.tooltip')).toBeNull();
  });

  it('moves the tooltip to another block tapped', () => {
    const fixture = createBar();
    segmentNamed(fixture, 'Coffee break').click();

    segmentNamed(fixture, 'C# study').click();
    fixture.detectChanges();

    expect(element(fixture).querySelector('.tooltip-block')?.textContent?.trim()).toBe(
      'C# study · 13:30–15:00',
    );
  });

  it('lets go of a tapped block when the tap lands elsewhere', () => {
    const fixture = createBar();
    segmentNamed(fixture, 'Coffee break').click();
    fixture.detectChanges();

    document.body.click();
    fixture.detectChanges();

    expect(element(fixture).querySelector('.tooltip')).toBeNull();
  });

  it('shows a block that has the keyboard focus', () => {
    const fixture = createBar();
    const study = segmentNamed(fixture, 'C# study');

    study.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    const shown = element(fixture).querySelector('.tooltip-category')?.textContent?.trim();
    study.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(shown).toBe('Study');
    expect(element(fixture).querySelector('.tooltip')).toBeNull();
  });

  it('makes every block reachable by keyboard', () => {
    const segments = [...element(createBar()).querySelectorAll('.segment')];

    expect(segments.every((segment) => segment instanceof HTMLButtonElement)).toBe(true);
  });

  // Regression: a live region announced the block name on every hover, and matched the selector the
  // editor tests use to look for the schedule warning.
  it('keeps the tooltip out of the accessibility tree and off the status role', () => {
    const fixture = createBar();
    segmentNamed(fixture, 'C# study').click();
    fixture.detectChanges();

    const tooltip = element(fixture).querySelector('.tooltip');

    expect([tooltip?.getAttribute('aria-hidden'), tooltip?.getAttribute('role')]).toEqual([
      'true',
      null,
    ]);
    expect(element(fixture).querySelector('[role="status"]')).toBeNull();
  });

  it('shows no tooltip for a block deleted while it was tapped', () => {
    const fixture = createBar();
    segmentNamed(fixture, 'Coffee break').click();

    fixture.componentRef.setInput('routine', { ...WITH_BREAK, blocks: SAMPLE_ROUTINES[0].blocks });
    fixture.detectChanges();

    expect(element(fixture).querySelector('.tooltip')).toBeNull();
  });

  it('totals the time of each category in a legend, largest first', () => {
    const entries = [...element(createBar()).querySelectorAll('.legend-entry')].map(
      (entry) =>
        `${entry.querySelector('.legend-name')?.textContent} ${entry.querySelector('.legend-duration')?.textContent}`,
    );

    expect(entries).toEqual(['Networking 2h', 'Study 1h30']);
  });

  it('shows no legend when no block has a category', () => {
    const plain: Routine = { ...WITH_BREAK, blocks: [WITH_BREAK.blocks[0]] };

    expect(element(createBar(plain)).querySelector('.legend')).toBeNull();
  });
});
