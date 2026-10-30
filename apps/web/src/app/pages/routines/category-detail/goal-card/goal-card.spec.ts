import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Goal } from '../../../../core/routines/goal';
import { GoalCard } from './goal-card';

const WEEKLY: Goal = {
  id: 'g1',
  categoryId: 'study',
  title: 'Study C# 5x a week',
  type: 'frequency',
  period: 'weekly',
  done: 3,
  target: 5,
};

const OBJECTIVE: Goal = {
  id: 'g2',
  categoryId: 'study',
  title: 'Finish the C# course',
  type: 'objective',
  period: 'custom',
  done: 0,
  target: 1,
  deadline: '2026-12-15',
};

function text(fixture: ComponentFixture<GoalCard>, selector: string): string | undefined {
  return (fixture.nativeElement as HTMLElement).querySelector(selector)?.textContent?.trim();
}

function createCard(goal: Goal = WEEKLY): ComponentFixture<GoalCard> {
  const fixture = TestBed.createComponent(GoalCard);
  fixture.componentRef.setInput('goal', goal);
  fixture.componentRef.setInput('color', '#7DD3FC');
  fixture.componentRef.setInput('today', new Date(2026, 9, 28));
  fixture.detectChanges();
  return fixture;
}

function button(fixture: ComponentFixture<GoalCard>, label: string): HTMLButtonElement {
  const found = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
    `[aria-label="${label}"]`,
  );
  if (found === null) throw new Error(`Expected a button labelled "${label}", found none`);
  return found;
}

function clickText(fixture: ComponentFixture<GoalCard>, text: string): void {
  const buttons = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')];
  buttons.find((candidate) => candidate.textContent?.trim() === text)!.click();
  fixture.detectChanges();
}

describe('GoalCard', () => {
  it('has no +1 or −1: a frequency goal counts completed blocks by itself', () => {
    const fixture = createCard();

    const labels = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].map(
      (candidate) => candidate.textContent?.trim(),
    );

    expect(labels).not.toContain('+1');
    expect(labels).not.toContain('−1');
  });

  it('shows what was done beyond the target', () => {
    const fixture = createCard({ ...WEEKLY, done: 7 });

    expect(text(fixture, '.extra')).toBe('+2');
    expect(text(fixture, '.value')).toBe('7 of 5 times');
    expect(text(fixture, '.footer')).toBe('Completed · 2 extra');
  });

  it('asks the page to mark an objective achieved', () => {
    const fixture = createCard(OBJECTIVE);
    const toggled: string[] = [];
    fixture.componentInstance.toggleAchieved.subscribe((id) => toggled.push(id));

    clickText(fixture, 'Mark achieved');

    expect(toggled).toEqual(['g2']);
  });

  it('shows an achieved objective as pressed, with the day it was achieved', () => {
    const fixture = createCard({ ...OBJECTIVE, done: 1, achievedOn: '2026-10-27' });

    const achieve = (fixture.nativeElement as HTMLElement).querySelector('.achieve');

    expect(achieve?.getAttribute('aria-pressed')).toBe('true');
    expect(achieve?.textContent?.trim()).toBe('Achieved');
    expect(text(fixture, '.value')).toBe('Achieved on Oct 27');
  });

  it('asks the page to edit the goal', () => {
    const fixture = createCard();
    const edited: string[] = [];
    fixture.componentInstance.edit.subscribe((id) => edited.push(id));

    button(fixture, 'Edit Study C# 5x a week').click();

    expect(edited).toEqual(['g1']);
  });

  it('asks before deleting and keeps the goal on Cancel', () => {
    const fixture = createCard();
    const removed: string[] = [];
    fixture.componentInstance.remove.subscribe((id) => removed.push(id));

    button(fixture, 'Delete Study C# 5x a week').click();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Delete this goal and its progress?',
    );
    clickText(fixture, 'Cancel');

    expect(removed).toEqual([]);
    expect((fixture.nativeElement as HTMLElement).querySelector('.confirm')).toBeNull();
  });

  it('deletes the goal once confirmed', () => {
    const fixture = createCard();
    const removed: string[] = [];
    fixture.componentInstance.remove.subscribe((id) => removed.push(id));

    button(fixture, 'Delete Study C# 5x a week').click();
    fixture.detectChanges();
    clickText(fixture, 'Delete');

    expect(removed).toEqual(['g1']);
  });
});
