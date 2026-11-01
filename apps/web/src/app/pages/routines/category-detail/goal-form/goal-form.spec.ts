import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Goal, GoalChanges } from '../../../../core/routines/goal';
import { GoalDraft } from '../../../../core/routines/routines-store';
import { GoalForm } from './goal-form';

function createForm(): ComponentFixture<GoalForm> {
  const fixture = TestBed.createComponent(GoalForm);
  fixture.componentRef.setInput('categoryId', 'study');
  fixture.componentRef.setInput('color', '#7DD3FC');
  fixture.componentRef.setInput('today', new Date(2026, 9, 26));
  fixture.detectChanges();
  return fixture;
}

function element(fixture: ComponentFixture<GoalForm>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function click(fixture: ComponentFixture<GoalForm>, selector: string, index = 0): void {
  element(fixture).querySelectorAll<HTMLButtonElement>(selector)[index].click();
  fixture.detectChanges();
}

function setField(
  fixture: ComponentFixture<GoalForm>,
  selector: string,
  value: string,
  eventName = 'input',
): void {
  const field = element(fixture).querySelector<HTMLInputElement>(selector);
  if (field === null) throw new Error(`Expected a field matching ${selector}, found none`);
  field.value = value;
  field.dispatchEvent(new Event(eventName));
  fixture.detectChanges();
}

function submit(fixture: ComponentFixture<GoalForm>): GoalDraft[] {
  const drafts: GoalDraft[] = [];
  fixture.componentInstance.create.subscribe((draft) => drafts.push(draft));
  element(fixture).querySelector('form')?.dispatchEvent(new Event('submit'));
  return drafts;
}

function preview(fixture: ComponentFixture<GoalForm>): string {
  return (
    element(fixture).querySelector('.preview-card')?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
  );
}

const STUDY_GOAL: Goal = {
  id: 'g1',
  categoryId: 'study',
  title: 'Study C# 5x a week',
  type: 'frequency',
  period: 'weekly',
  done: 2,
  target: 5,
};

/** An objective set before objectives were marked by hand: it still counts modules. */
const COURSE_OBJECTIVE: Goal = {
  id: 'g2',
  categoryId: 'study',
  title: 'Finish the C# course',
  type: 'objective',
  period: 'custom',
  done: 0,
  target: 12,
  unit: 'modules',
  deadline: '2026-12-15',
};

function editForm(goal: Goal): ComponentFixture<GoalForm> {
  const fixture = TestBed.createComponent(GoalForm);
  fixture.componentRef.setInput('categoryId', goal.categoryId);
  fixture.componentRef.setInput('color', '#7DD3FC');
  fixture.componentRef.setInput('today', new Date(2026, 9, 26));
  fixture.componentRef.setInput('goal', goal);
  fixture.detectChanges();
  return fixture;
}

function submitEdit(fixture: ComponentFixture<GoalForm>): GoalChanges[] {
  const saved: GoalChanges[] = [];
  fixture.componentInstance.save.subscribe((changes) => saved.push(changes));
  element(fixture).querySelector('form')?.dispatchEvent(new Event('submit'));
  return saved;
}

describe('GoalForm', () => {
  it('previews a weekly frequency goal by default', () => {
    const fixture = createForm();

    const text = preview(fixture);

    for (const part of [
      'Frequency · Weekly',
      'Your goal name',
      '0 of 3 times',
      'Renews on Monday',
    ]) {
      expect(text).toContain(part);
    }
  });

  it('emits a frequency goal draft', () => {
    const fixture = createForm();
    setField(fixture, '.name-input', 'Practice daily');
    setField(fixture, '.number-input', '0', 'change');

    expect(submit(fixture)).toEqual([
      {
        categoryId: 'study',
        title: 'Practice daily',
        type: 'frequency',
        period: 'weekly',
        target: 1,
        unit: undefined,
        deadline: undefined,
      },
    ]);
  });

  it('explains that a frequency goal counts completed blocks', () => {
    const fixture = createForm();

    expect(element(fixture).querySelector('.counting-hint')?.textContent).toContain(
      'Each block of this category you complete counts once',
    );
  });

  it('emits an objective for a custom period with no count to fill in', () => {
    const fixture = createForm();
    setField(fixture, '.name-input', 'Finish the book');
    click(fixture, '.type', 1);
    click(fixture, '.periods .ui-chip', 4);

    const [draft] = submit(fixture);

    expect(draft).toMatchObject({
      type: 'objective',
      period: 'custom',
      target: 1,
    });
    expect(element(fixture).querySelector('.number-input')).toBeNull();
    expect(preview(fixture)).toContain('Not achieved yet');
  });

  // Regression: a "From" date was shown and previewed but never saved; the period only has an end.
  it('asks a custom period for its end only, and previews and saves that day', () => {
    const fixture = createForm();
    setField(fixture, '.name-input', 'Finish the book');
    click(fixture, '.periods .ui-chip', 4);
    const dates = element(fixture).querySelectorAll<HTMLInputElement>('.custom-dates input');
    setField(fixture, '.custom-dates input', '2026-12-20', 'change');

    const [draft] = submit(fixture);

    expect(dates).toHaveLength(1);
    expect(preview(fixture)).toContain('until Dec 20');
    expect(draft.deadline).toBe('2026-12-20');
  });

  it('does not emit without a name', () => {
    expect(submit(createForm())).toEqual([]);
  });

  it('emits dismiss on cancel', () => {
    const fixture = createForm();
    let dismissed = false;
    fixture.componentInstance.dismiss.subscribe(() => (dismissed = true));

    click(fixture, '.form-actions .ui-button-ghost');

    expect(dismissed).toBe(true);
  });

  it('opens with the goal to edit already filled in', () => {
    const fixture = editForm(STUDY_GOAL);

    expect(element(fixture).querySelector<HTMLInputElement>('.name-input')?.value).toBe(
      'Study C# 5x a week',
    );
    expect(element(fixture).querySelector('.form-title')?.textContent).toBe('Edit goal');
    expect(element(fixture).querySelector('.number-input')).toHaveProperty('value', '5');
    expect(element(fixture).querySelector('[aria-pressed="true"].ui-chip')).not.toBeNull();
  });

  it('saves the edited fields, not the type or category', () => {
    const fixture = editForm(STUDY_GOAL);
    setField(fixture, '.name-input', 'Study C# 3x a week');
    setField(fixture, '.number-input', '3', 'change');

    expect(submitEdit(fixture)).toEqual([
      {
        title: 'Study C# 3x a week',
        period: 'weekly',
        target: 3,
        unit: undefined,
        deadline: undefined,
      },
    ]);
  });

  it('does not let the type change while editing', () => {
    const fixture = editForm(STUDY_GOAL);

    const types = element(fixture).querySelectorAll<HTMLButtonElement>('.type');

    expect([types[0].disabled, types[1].disabled]).toEqual([false, true]);
  });

  it('does not emit a new goal while editing', () => {
    const fixture = editForm(STUDY_GOAL);

    expect(submit(fixture)).toEqual([]);
  });

  // Regression: renaming an objective set before objectives were marked by hand reset it to 1 and
  // dropped its unit.
  it('keeps the target and unit of an objective when only its title changes', () => {
    const fixture = editForm(COURSE_OBJECTIVE);
    setField(fixture, '.name-input', 'Finish the C# course for real');

    expect(submitEdit(fixture)).toEqual([
      {
        title: 'Finish the C# course for real',
        period: 'custom',
        target: 12,
        unit: 'modules',
        deadline: '2026-12-15',
      },
    ]);
  });
});
