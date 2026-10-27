import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BlockOutcomeKind } from '../../../../core/routines/day-plan';
import { Routine } from '../../../../core/routines/routine';
import { SAMPLE_CATEGORIES } from '../../../../core/routines/sample-routines';
import { DayTimeline } from './day-timeline';

const MORNING: Routine = {
  id: 'morning',
  name: 'Morning',
  days: [0],
  start: '06:00',
  end: '10:00',
  blocks: [
    { id: 'run', name: 'Morning run', start: '06:00', end: '06:30', categoryId: 'exercise' },
    { id: 'study', name: 'C# study', start: '07:00', end: '09:00', categoryId: 'study' },
  ],
};
/** 06:10, during the run. */
const DURING_RUN = 6 * 60 + 10;

function createTimeline(
  outcomes: ReadonlyMap<string, BlockOutcomeKind> = new Map(),
): ComponentFixture<DayTimeline> {
  const fixture = TestBed.createComponent(DayTimeline);
  fixture.componentRef.setInput('routine', MORNING);
  fixture.componentRef.setInput('categories', SAMPLE_CATEGORIES);
  fixture.componentRef.setInput('nowMinutes', DURING_RUN);
  fixture.componentRef.setInput('outcomes', outcomes);
  fixture.detectChanges();
  return fixture;
}

function blockNamed(fixture: ComponentFixture<DayTimeline>, name: string): HTMLElement {
  const blocks = [
    ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.block'),
  ];
  return blocks.find((block) => block.querySelector('.block-name')?.textContent?.trim() === name)!;
}

describe('DayTimeline', () => {
  // Regression: a 30-minute block squeezed two lines of text into 24px and they overlapped.
  it('draws a short block on one line with its details in a tooltip', () => {
    const run = blockNamed(createTimeline(), 'Morning run');

    expect(run.classList).toContain('is-compact');
    expect(run.title).toBe('Morning run · 06:00 – 06:30 · Exercise');
  });

  it('shows the category of a short block as a labelled dot, without the "Now" pill', () => {
    const run = blockNamed(createTimeline(), 'Morning run');

    expect(run.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Exercise');
    expect(run.querySelector('.category-badge')).toBeNull();
    expect(run.querySelector('.ui-badge-now')).toBeNull();
  });

  it('keeps the two-line layout and the category badge for a long block', () => {
    const study = blockNamed(createTimeline(), 'C# study');

    expect(study.classList).not.toContain('is-compact');
    expect(study.title).toBe('');
    expect(study.querySelector('.category-badge')?.textContent).toContain('Study');
  });

  it('marks a completed block with a check and "Done", and it is no longer "now"', () => {
    const run = blockNamed(createTimeline(new Map([['run', 'done']])), 'Morning run');

    expect(run.classList).toContain('is-done');
    expect(run.querySelector('.done-check')).not.toBeNull();
    expect(run.querySelector('.outcome-label')?.textContent?.trim()).toBe('Done');
    expect(run.getAttribute('aria-current')).toBeNull();
  });

  it('crosses out a skipped block', () => {
    const study = blockNamed(createTimeline(new Map([['study', 'skipped']])), 'C# study');

    expect(study.classList).toContain('is-skipped');
    expect(study.querySelector('.done-check')).toBeNull();
    expect(study.querySelector('.outcome-label')?.textContent?.trim()).toBe('Skipped');
  });
});
