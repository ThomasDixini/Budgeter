import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Clock } from '../../../core/calendar/clock';
import { FixedClock } from '../../../core/calendar/fixed-clock';
import { NEVER, Observable } from 'rxjs';
import {
  FakeCategoriesGateway,
  FakeGoalsGateway,
  provideFakeRoutinesGateways,
} from '../../../core/routines/fake-routines-gateways';
import { Goal } from '../../../core/routines/goal';
import { RoutinesStore } from '../../../core/routines/routines-store';
import { CategoryDetail } from './category-detail';

interface Page {
  readonly element: HTMLElement;
  readonly render: () => void;
}

/** Goals that never arrive, as while the API is still answering. */
class PendingGoalsGateway extends FakeGoalsGateway {
  override list(): Observable<readonly Goal[]> {
    return NEVER;
  }
}

async function openCategory(url: string, goals = new FakeGoalsGateway()): Promise<Page> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'routines/categories/:categoryId', component: CategoryDetail }]),
      { provide: Clock, useValue: new FixedClock(new Date(2026, 9, 26, 9)) },
      ...provideFakeRoutinesGateways(new FakeCategoriesGateway(), goals),
    ],
  });
  const harness = await RouterTestingHarness.create(url);
  harness.detectChanges();
  return {
    element: harness.routeNativeElement as HTMLElement,
    render: () => harness.detectChanges(),
  };
}

function click(page: Page, selector: string, index = 0): void {
  page.element.querySelectorAll<HTMLButtonElement>(selector)[index].click();
  page.render();
}

function goalTitles(page: Page): string[] {
  return [...page.element.querySelectorAll('app-goal-card .title')].map(
    (title) => title.textContent ?? '',
  );
}

describe('CategoryDetail', () => {
  it('shows the category headline numbers', async () => {
    const page = await openCategory('/routines/categories/study');

    const values = [...page.element.querySelectorAll('.stat-value')].map(
      (value) => value.textContent,
    );

    expect(values).toEqual(['3', '53%', '7h30']);
  });

  it('edits the category name and color', async () => {
    const page = await openCategory('/routines/categories/study');
    click(page, '.hero-top button', 0);
    const name = page.element.querySelector<HTMLInputElement>(
      'form[aria-label="Edit category"] input',
    );
    if (name === null) throw new Error('Expected the category name input, found none');
    name.value = 'Learning';
    name.dispatchEvent(new Event('input'));
    click(page, '.swatch', 2);

    page.element
      .querySelector('form[aria-label="Edit category"]')
      ?.dispatchEvent(new Event('submit'));
    page.render();

    expect(TestBed.inject(RoutinesStore).categories()[0]).toEqual({
      id: 'study',
      name: 'Learning',
      color: '#F0ABFC',
    });
    expect(page.element.querySelector('#category-title')?.textContent).toBe('Learning');
  });

  it('deletes the category after confirming', async () => {
    const page = await openCategory('/routines/categories/study');

    click(page, '.hero-top button', 1);
    expect(TestBed.inject(RoutinesStore).categories()).toHaveLength(4);
    click(page, '[aria-label="Confirm deletion"] button', 0);

    expect(
      TestBed.inject(RoutinesStore)
        .categories()
        .map((category) => category.id),
    ).not.toContain('study');
  });

  it('lists the routine blocks of the category', async () => {
    const page = await openCategory('/routines/categories/study');

    expect(page.element.querySelector('.routine-block-when')?.textContent).toBe(
      'Mon–Fri · 13:30–15:00',
    );
  });

  it('filters goals by period and type', async () => {
    const page = await openCategory('/routines/categories/study');

    click(page, '.period', 2);
    expect(goalTitles(page)).toEqual(['Study C# 5x a week']);

    click(page, '.type', 2);
    expect(goalTitles(page)).toEqual([]);
    expect(page.element.querySelector('.no-goals')).not.toBeNull();
  });

  it('marks an objective achieved from its card', async () => {
    const page = await openCategory('/routines/categories/study');

    click(page, '.achieve', 0);

    expect(
      TestBed.inject(RoutinesStore)
        .goals()
        .find((goal) => goal.id === 'g2')?.achievedOn,
    ).toBe('2026-10-26');
  });

  it('opens the goal form when arriving from a new category', async () => {
    const page = await openCategory('/routines/categories/study?newGoal=true');

    expect(page.element.querySelector('app-goal-form')).not.toBeNull();
  });

  it('adds a goal from the form and closes it', async () => {
    const page = await openCategory('/routines/categories/reading?newGoal=true');
    const name = page.element.querySelector<HTMLInputElement>('.name-input');
    if (name === null) throw new Error('Expected the goal name input, found none');
    name.value = 'Read before bed';
    name.dispatchEvent(new Event('input'));

    page.element.querySelector('app-goal-form form')?.dispatchEvent(new Event('submit'));
    page.render();

    expect(page.element.querySelector('app-goal-form')).toBeNull();
    expect(goalTitles(page)).toContain('Read before bed');
  });

  function nameInForm(page: Page): string | undefined {
    return page.element.querySelector<HTMLInputElement>('app-goal-form .name-input')?.value;
  }

  function editButton(page: Page, title: string): HTMLButtonElement {
    return page.element.querySelector<HTMLButtonElement>(`[aria-label="Edit ${title}"]`)!;
  }

  // Regression: opening another goal's form kept the first one's values, and saving overwrote it.
  it('fills the form with the goal clicked, even when another goal was already being edited', async () => {
    const page = await openCategory('/routines/categories/study');

    editButton(page, 'Study C# 5x a week').click();
    page.render();
    editButton(page, 'Finish the C# course').click();
    page.render();

    expect(nameInForm(page)).toBe('Finish the C# course');
    expect(page.element.querySelectorAll('app-goal-form')).toHaveLength(1);
  });

  it('saves the edit onto the goal that was clicked', async () => {
    const goals = new FakeGoalsGateway();
    const page = await openCategory('/routines/categories/study', goals);
    editButton(page, 'Study C# 5x a week').click();
    page.render();
    editButton(page, 'Review notes every day').click();
    page.render();
    const name = page.element.querySelector<HTMLInputElement>('app-goal-form .name-input')!;
    name.value = 'Review notes twice a day';
    name.dispatchEvent(new Event('input'));

    page.element.querySelector('app-goal-form form')?.dispatchEvent(new Event('submit'));
    page.render();

    expect(goals.updated.map((update) => update.goalId)).toEqual(['g3']);
    expect(goalTitles(page)).toContain('Review notes twice a day');
    expect(goalTitles(page)).toContain('Study C# 5x a week');
  });

  it('deletes a goal from its card after confirming', async () => {
    const goals = new FakeGoalsGateway();
    const page = await openCategory('/routines/categories/study', goals);

    page.element
      .querySelector<HTMLButtonElement>('[aria-label="Delete Review notes every day"]')!
      .click();
    page.render();
    const confirm = page.element.querySelector<HTMLElement>('.confirm')!;
    [...confirm.querySelectorAll('button')]
      .find((button) => button.textContent?.trim() === 'Delete')!
      .click();
    page.render();

    expect(goals.deleted).toEqual(['g3']);
    expect(goalTitles(page)).not.toContain('Review notes every day');
  });

  it('explains when the category does not exist', async () => {
    const page = await openCategory('/routines/categories/unknown');

    expect(page.element.textContent).toContain('This category does not exist anymore.');
  });

  it('does not claim the category is missing while data is loading', async () => {
    const page = await openCategory('/routines/categories/unknown', new PendingGoalsGateway());

    expect(page.element.textContent).not.toContain('does not exist');
  });
});
