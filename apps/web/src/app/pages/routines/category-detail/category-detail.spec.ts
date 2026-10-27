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

    expect(values).toEqual(['3', '64%', '7h30']);
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

  it('logs progress with +1', async () => {
    const page = await openCategory('/routines/categories/study');

    click(page, '.increment', 0);

    expect(TestBed.inject(RoutinesStore).goals()[0].done).toBe(4);
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

  it('explains when the category does not exist', async () => {
    const page = await openCategory('/routines/categories/unknown');

    expect(page.element.textContent).toContain('This category does not exist anymore.');
  });

  it('does not claim the category is missing while data is loading', async () => {
    const page = await openCategory('/routines/categories/unknown', new PendingGoalsGateway());

    expect(page.element.textContent).not.toContain('does not exist');
  });
});
