import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../../app.routes';
import { Clock } from '../../../core/calendar/clock';
import { FixedClock } from '../../../core/calendar/fixed-clock';
import { BlockOutcome } from '../../../core/routines/day-plan';
import { FakeBlockOutcomesGateway } from '../../../core/routines/fake-block-outcomes-gateway';
import {
  FakeCategoriesGateway,
  FakeGoalsGateway,
  FakeRoutinesGateway,
  provideFakeRoutinesGateways,
} from '../../../core/routines/fake-routines-gateways';
import { Goal } from '../../../core/routines/goal';
import { SAMPLE_GOALS } from '../../../core/routines/sample-routines';

/** Wednesday 28 Oct 2026: the page opens on Tuesday the 27th. */
const TODAY = new Date(2026, 9, 28, 10, 0);

const TUESDAY_OUTCOMES: readonly BlockOutcome[] = [
  { routineId: 'weekdays', blockId: 'csharp', outcome: 'done', at: '14:50' },
  { routineId: 'weekdays', blockId: 'network', outcome: 'skipped', at: '16:00' },
];

function goalsOnTuesday(): readonly Goal[] {
  return SAMPLE_GOALS.map((goal) => (goal.id === 'g1' ? { ...goal, done: 6 } : goal));
}

async function openHistory() {
  const outcomes = new FakeBlockOutcomesGateway();
  outcomes.outcomesOnDay.set('2026-10-27', TUESDAY_OUTCOMES);
  const goals = new FakeGoalsGateway();
  goals.goalsOnDay.set('2026-10-27', goalsOnTuesday());
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      { provide: Clock, useValue: new FixedClock(TODAY) },
      ...provideFakeRoutinesGateways(
        new FakeCategoriesGateway(),
        goals,
        new FakeRoutinesGateway(),
        undefined,
        outcomes,
      ),
    ],
  });
  const harness = await RouterTestingHarness.create('/routines/history');
  harness.detectChanges();
  const element = harness.routeNativeElement as HTMLElement;
  return {
    element,
    goals,
    outcomes,
    render: () => harness.detectChanges(),
  };
}

function texts(element: HTMLElement, selector: string): string[] {
  return [...element.querySelectorAll(selector)].map((node) => node.textContent?.trim() ?? '');
}

describe('History page', () => {
  it('opens on yesterday', async () => {
    const { element } = await openHistory();

    expect(element.querySelector('h1')?.textContent?.trim()).toBe('Tuesday, October 27');
  });

  it('lists the blocks completed that day, and the skipped ones apart', async () => {
    const { element } = await openHistory();

    expect(texts(element, '.block-row:not(.is-skipped) .row-title')).toEqual(['C# study']);
    expect(texts(element, '.block-row.is-skipped .row-title')).toEqual(['Networking']);
  });

  it('lists the goals met, with what was done beyond the target', async () => {
    const { element } = await openHistory();

    const met = texts(element, '.goal-row.is-met .row-title');

    expect(met).toContain('Study C# 5x a week');
    expect(met).toContain('Review notes every day');
    expect(texts(element, '.goal-row.is-met .value')).toContain('6/5 · 1 extra');
  });

  it('names the period each goal was counted in', async () => {
    const { element } = await openHistory();

    expect(texts(element, '.goal-row.is-met .row-meta')).toContain('Frequency · Week of Oct 26');
  });

  it('goes back one day and loads that day', async () => {
    const page = await openHistory();

    page.element.querySelector<HTMLButtonElement>('[aria-label="Previous day"]')!.click();
    TestBed.tick();

    expect(page.outcomes.listedDays.at(-1)).toBe('2026-10-26');
    expect(texts(page.element, '.block-row .row-title')).toEqual([]);
  });

  it('cannot go past today', async () => {
    const page = await openHistory();
    const next = page.element.querySelector<HTMLButtonElement>('[aria-label="Next day"]')!;

    next.click();
    TestBed.tick();

    expect(page.element.querySelector('h1')?.textContent?.trim()).toBe('Wednesday, October 28');
    expect(next.disabled).toBe(true);
  });

  it('shows the day picked in the date field, and ignores a future one', async () => {
    const page = await openHistory();
    const field = page.element.querySelector<HTMLInputElement>('.day-input')!;

    field.value = '2026-10-20';
    field.dispatchEvent(new Event('change'));
    TestBed.tick();
    field.value = '2026-11-20';
    field.dispatchEvent(new Event('change'));
    TestBed.tick();

    expect(page.goals.listedDays).toContain('2026-10-20');
    expect(page.element.querySelector('h1')?.textContent?.trim()).toBe('Tuesday, October 20');
  });

  it('is reachable from its own tab', async () => {
    const { element } = await openHistory();

    expect(
      element.ownerDocument.querySelector('.tab[aria-current="page"]')?.textContent?.trim(),
    ).toBe('History');
  });
});
