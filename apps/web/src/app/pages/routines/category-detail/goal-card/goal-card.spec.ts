import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Goal } from '../../../../core/routines/goal';
import { GoalCard } from './goal-card';

const MANUAL: Goal = {
  id: 'g1',
  categoryId: 'study',
  title: 'Study C# 5x a week',
  type: 'frequency',
  period: 'weekly',
  tracking: 'manual',
  done: 3,
  target: 5,
};

function createCard(goal: Goal = MANUAL): ComponentFixture<GoalCard> {
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
  it('logs progress with +1 and takes it back with −1', () => {
    const fixture = createCard();
    const events: string[] = [];
    fixture.componentInstance.increment.subscribe(() => events.push('+1'));
    fixture.componentInstance.decrement.subscribe(() => events.push('-1'));

    button(fixture, 'Log progress on Study C# 5x a week').click();
    button(fixture, 'Take back progress on Study C# 5x a week').click();

    expect(events).toEqual(['+1', '-1']);
  });

  it('cannot take back anything when there is no progress', () => {
    const fixture = createCard({ ...MANUAL, done: 0 });

    expect(button(fixture, 'Take back progress on Study C# 5x a week').disabled).toBe(true);
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

  it('shows a goal that counts blocks as automatic: no +1 or −1, and a note instead of the renewal', () => {
    const fixture = createCard({ ...MANUAL, tracking: 'blocks' });

    expect(button(fixture, 'Log progress on Study C# 5x a week').disabled).toBe(true);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '[aria-label="Take back progress on Study C# 5x a week"]',
      ),
    ).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.footer')?.textContent).toBe(
      'Counts completed blocks',
    );
  });

  it('has nothing left to log once the target is reached', () => {
    const fixture = createCard({ ...MANUAL, done: 5 });

    expect(button(fixture, 'Log progress on Study C# 5x a week').disabled).toBe(true);
    expect(button(fixture, 'Take back progress on Study C# 5x a week').disabled).toBe(false);
  });
});
