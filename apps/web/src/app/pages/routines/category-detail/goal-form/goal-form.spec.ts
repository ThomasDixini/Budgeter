import { ComponentFixture, TestBed } from '@angular/core/testing';
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

describe('GoalForm', () => {
  it('previews a weekly frequency goal by default', () => {
    const fixture = createForm();

    const text = preview(fixture);

    for (const part of [
      'Frequency · Weekly',
      'Your goal name',
      '0 of 3 times',
      'Renews on Sunday',
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

  it('emits an objective with a custom deadline', () => {
    const fixture = createForm();
    setField(fixture, '.name-input', 'Finish the book');
    click(fixture, '.type', 1);
    click(fixture, '.periods .ui-chip', 4);
    setField(fixture, '.unit-input', 'chapters');
    setField(fixture, '.custom-dates input[type="date"]:last-of-type', '2026-12-01', 'change');

    const [draft] = submit(fixture);

    expect(draft).toMatchObject({
      type: 'objective',
      period: 'custom',
      target: 10,
      unit: 'chapters',
    });
    expect(preview(fixture)).toContain('0 of 10 chapters');
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
});
