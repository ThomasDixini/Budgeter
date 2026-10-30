import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Category } from './category';
import { Goal } from './goal';
import { HttpCategoriesGateway } from './http-categories-gateway';
import { HttpGoalsGateway } from './http-goals-gateway';
import { BlockOutcome } from './day-plan';
import { HttpBlockOutcomesGateway } from './http-block-outcomes-gateway';
import { HttpRoutinesGateway } from './http-routines-gateway';
import { Routine } from './routine';

const STUDY: Category = { id: 'study', name: 'Study', color: '#7DD3FC' };
const WEEKEND: Routine = {
  id: 'weekend',
  name: 'Weekend',
  days: [5, 6],
  start: '09:00',
  end: '14:00',
  blocks: [{ id: 'read', name: 'Reading', start: '10:00', end: '12:00', categoryId: 'study' }],
};
const WEEKLY_GOAL: Goal = {
  id: 'g1',
  categoryId: 'study',
  title: 'Study C# 5x a week',
  type: 'frequency',
  period: 'weekly',
  done: 0,
  target: 5,
};

let httpTesting: HttpTestingController;

beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      HttpCategoriesGateway,
      HttpGoalsGateway,
      HttpRoutinesGateway,
      HttpBlockOutcomesGateway,
    ],
  });
  httpTesting = TestBed.inject(HttpTestingController);
});

afterEach(() => httpTesting.verify());

describe('HttpCategoriesGateway', () => {
  it('lists categories from the API', () => {
    let received: readonly Category[] = [];

    TestBed.inject(HttpCategoriesGateway)
      .list()
      .subscribe((categories) => (received = categories));
    httpTesting.expectOne({ method: 'GET', url: '/api/categories' }).flush([STUDY]);

    expect(received).toEqual([STUDY]);
  });

  it('posts a new category', () => {
    TestBed.inject(HttpCategoriesGateway).create(STUDY).subscribe();

    const request = httpTesting.expectOne({ method: 'POST', url: '/api/categories' });

    expect(request.request.body).toEqual(STUDY);
    request.flush(STUDY);
  });

  it('puts the name and color of an edited category', () => {
    TestBed.inject(HttpCategoriesGateway).update(STUDY).subscribe();

    const request = httpTesting.expectOne({ method: 'PUT', url: '/api/categories/study' });

    expect(request.request.body).toEqual({ name: 'Study', color: '#7DD3FC' });
    request.flush(STUDY);
  });

  it('deletes a category, escaping its id', () => {
    TestBed.inject(HttpCategoriesGateway).delete('a/b').subscribe();

    httpTesting.expectOne({ method: 'DELETE', url: '/api/categories/a%2Fb' }).flush(null);
  });
});

describe('HttpRoutinesGateway', () => {
  it('lists routines from the API', () => {
    let received: readonly Routine[] = [];

    TestBed.inject(HttpRoutinesGateway)
      .list()
      .subscribe((routines) => (received = routines));
    httpTesting.expectOne({ method: 'GET', url: '/api/routines' }).flush([WEEKEND]);

    expect(received).toEqual([WEEKEND]);
  });

  it('puts the whole routine at its escaped id', () => {
    const routine: Routine = { ...WEEKEND, id: 'week end' };

    TestBed.inject(HttpRoutinesGateway).save(routine).subscribe();

    const request = httpTesting.expectOne({ method: 'PUT', url: '/api/routines/week%20end' });
    expect(request.request.body).toEqual(routine);
    request.flush(routine);
  });

  it('deletes the routine at its escaped id', () => {
    let isDone = false;

    TestBed.inject(HttpRoutinesGateway)
      .delete('week end')
      .subscribe({ complete: () => (isDone = true) });
    httpTesting
      .expectOne({ method: 'DELETE', url: '/api/routines/week%20end' })
      .flush(null, { status: 204, statusText: 'No Content' });

    expect(isDone).toBe(true);
  });
});

describe('HttpBlockOutcomesGateway', () => {
  const outcome: BlockOutcome = {
    routineId: 'week days',
    blockId: 'gym',
    outcome: 'skipped',
    at: '19:10',
  };

  it("asks for a day's outcomes", () => {
    let received: readonly BlockOutcome[] = [];

    TestBed.inject(HttpBlockOutcomesGateway)
      .list('2026-10-27')
      .subscribe((outcomes) => (received = outcomes));
    httpTesting
      .expectOne({ method: 'GET', url: '/api/block-outcomes?date=2026-10-27' })
      .flush([outcome]);

    expect(received).toEqual([outcome]);
  });

  it('puts the outcome under the routine, day and block', () => {
    TestBed.inject(HttpBlockOutcomesGateway).record('2026-10-27', outcome).subscribe();

    const request = httpTesting.expectOne({
      method: 'PUT',
      url: '/api/routines/week%20days/days/2026-10-27/blocks/gym',
    });
    expect(request.request.body).toEqual({ outcome: 'skipped', at: '19:10' });
    request.flush(outcome);
  });

  it('deletes the outcome to undo it', () => {
    TestBed.inject(HttpBlockOutcomesGateway).undo('2026-10-27', 'week days', 'gym').subscribe();

    httpTesting
      .expectOne({ method: 'DELETE', url: '/api/routines/week%20days/days/2026-10-27/blocks/gym' })
      .flush(null);
  });
});

describe('HttpGoalsGateway', () => {
  it('lists goals from the API', () => {
    let received: readonly Goal[] = [];

    TestBed.inject(HttpGoalsGateway)
      .list('2026-10-28')
      .subscribe((goals) => (received = goals));
    httpTesting
      .expectOne({ method: 'GET', url: '/api/goals?date=2026-10-28' })
      .flush([WEEKLY_GOAL]);

    expect(received).toEqual([WEEKLY_GOAL]);
  });

  it('posts a new goal', () => {
    TestBed.inject(HttpGoalsGateway).create(WEEKLY_GOAL, '2026-10-28').subscribe();

    const request = httpTesting.expectOne({ method: 'POST', url: '/api/goals?date=2026-10-28' });

    expect(request.request.body).toEqual(WEEKLY_GOAL);
    request.flush(WEEKLY_GOAL);
  });

  it('puts whether an objective is achieved on a day, escaping the goal id', () => {
    let received: Goal | undefined;

    TestBed.inject(HttpGoalsGateway)
      .setAchievement('g 1', '2026-10-28', true)
      .subscribe((goal) => (received = goal));
    const request = httpTesting.expectOne({ method: 'PUT', url: '/api/goals/g%201/achievement' });
    request.flush({ ...WEEKLY_GOAL, achievedOn: '2026-10-28' });

    expect(request.request.body).toEqual({ date: '2026-10-28', achieved: true });
    expect(received?.achievedOn).toBe('2026-10-28');
  });

  it('puts the editable fields of a goal at its id for the day', () => {
    const changes = {
      title: 'Study C# 3x',
      period: 'weekly',
      target: 3,
    } as const;

    TestBed.inject(HttpGoalsGateway).update('g 1', changes, '2026-10-28').subscribe();

    const request = httpTesting.expectOne({
      method: 'PUT',
      url: '/api/goals/g%201?date=2026-10-28',
    });
    expect(request.request.body).toEqual(changes);
    request.flush(WEEKLY_GOAL);
  });

  it('deletes a goal at its escaped id', () => {
    TestBed.inject(HttpGoalsGateway).delete('g 1').subscribe();

    httpTesting.expectOne({ method: 'DELETE', url: '/api/goals/g%201' }).flush(null);
  });
});
