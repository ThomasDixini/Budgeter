import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RoutinesStore } from '../../../core/routines/routines-store';
import { STUDY_TIME, clickButton, openPage, text } from '../routines-page.testing';

function focusTitles(element: HTMLElement): string[] {
  return [...element.querySelectorAll('.focus-goal-title')].map(
    (title) => title.textContent?.trim() ?? '',
  );
}

describe('Today page', () => {
  it('highlights the block happening now', async () => {
    const element = await openPage('/routines');

    expect(text(element, '#now-title')).toBe('C# study');
    expect(text(element, '.block[aria-current="time"] .block-name')).toBe('C# study');
  });

  it('shows how much of the day has passed', async () => {
    const element = await openPage('/routines');

    expect(text(element, '.day-value')).toBe('69%');
  });

  it('points to the next block between blocks', async () => {
    const element = await openPage('/routines', new Date(2026, 9, 26, 7, 30));

    expect(text(element, '#now-title')).toBe('No block right now');
    expect(text(element, '.now-card .meta')).toContain('Next: Work at 08:00');
  });

  it('says when no routine runs today', async () => {
    const element = await openPage('/routines', STUDY_TIME, (store) =>
      store.saveRoutine({ ...store.routines()[0], days: [] }),
    );

    expect(element.querySelector('app-day-timeline')).toBeNull();
    expect(text(element, '.no-routine')).toContain('No routine runs today.');
  });

  it('lists the first three pending goals in focus', async () => {
    const element = await openPage('/routines');

    expect(focusTitles(element)).toEqual([
      'Study C# 5x a week',
      'Finish the C# course',
      '10 new contacts this month',
    ]);
  });

  it('opens every goal with its progress from "See all", pending ones first, without leaving Today', async () => {
    const element = await openPage('/routines');

    clickButton(element, 'See all (7)');

    expect(focusTitles(element)).toEqual([
      'Study C# 5x a week',
      'Finish the C# course',
      '10 new contacts this month',
      'Attend 1 event',
      'Work out 3x a week',
      'Review notes every day',
      'Read 12 books in 2026',
    ]);
    expect(text(element, '#goals-title')).toBe('All goals');
    expect(element.querySelectorAll('.focus-goal.is-met')).toHaveLength(2);
    expect(TestBed.inject(Router).url).toBe('/routines');
  });

  it('shows each goal with its progress once opened', async () => {
    const element = await openPage('/routines');

    clickButton(element, 'See all (7)');

    const values = [...element.querySelectorAll('.focus-goal-value')].map((value) =>
      value.textContent?.trim(),
    );
    expect(values).toContain('3/5');
    expect(values).toContain('Achieved on Oct 20');
  });

  it('marks an objective achieved from the goals card, which moves it to the goals met', async () => {
    const element = await openPage('/routines');

    element
      .querySelector<HTMLButtonElement>('[aria-label="Mark achieved: Finish the C# course"]')!
      .click();
    TestBed.tick();

    const goal = TestBed.inject(RoutinesStore)
      .goals()
      .find((current) => current.id === 'g2');
    expect(goal?.achievedOn).toBe('2026-10-26');
    expect(focusTitles(element)).not.toContain('Finish the C# course');
  });

  it('takes the achieved mark of an objective back from the goals card', async () => {
    const element = await openPage('/routines');
    clickButton(element, 'See all (7)');

    element
      .querySelector<HTMLButtonElement>(
        '[aria-label="Take back achieved on Read 12 books in 2026"]',
      )!
      .click();
    TestBed.tick();

    const goal = TestBed.inject(RoutinesStore)
      .goals()
      .find((current) => current.id === 'g6');
    expect(goal?.achievedOn).toBeUndefined();
  });

  it('goes back to the goals in focus with "Show less"', async () => {
    const element = await openPage('/routines');
    clickButton(element, 'See all (7)');

    clickButton(element, 'Show less');

    expect(focusTitles(element)).toHaveLength(3);
    expect(text(element, '#goals-title')).toBe('Goals in focus');
  });

  it('completes the running block and moves the rest of the day earlier', async () => {
    const element = await openPage('/routines');

    clickButton(element, 'Complete block');

    expect(text(element, '.now-card .title')).toBe('Networking');
    expect(text(element, '.now-card .meta .ui-tabular')).toBe('14:10 – 16:10');
    const study = element.querySelector('.block.is-done');
    expect(study?.textContent).toContain('C# study');
    expect(study?.textContent).toContain('13:30 – 14:10');
  });

  it('undoes a completed block from the Now card, back to plan', async () => {
    const element = await openPage('/routines');
    clickButton(element, 'Complete block');
    expect(text(element, '.last-ended span')).toBe('C# study completed');

    clickButton(element, 'Undo');

    expect(text(element, '.now-card .title')).toBe('C# study');
    expect(text(element, '.now-card .meta .ui-tabular')).toBe('13:30 – 15:00');
    expect(element.querySelector('.block.is-done')).toBeNull();
    expect(element.querySelector('.last-ended')).toBeNull();
  });

  it('undoes a skipped block from its button on the timeline', async () => {
    const element = await openPage('/routines');
    clickButton(element, 'Skip');

    element.querySelector<HTMLButtonElement>('[aria-label="Undo C# study"]')!.click();
    TestBed.tick();

    expect(element.querySelector('.block.is-skipped')).toBeNull();
    expect(text(element, '.now-card .title')).toBe('C# study');
  });

  it('skips the running block and crosses it out', async () => {
    const element = await openPage('/routines');

    clickButton(element, 'Skip');

    expect(element.querySelector('.block.is-skipped')?.textContent).toContain('C# study');
    expect(text(element, '.now-card .title')).toBe('Networking');
  });
});
