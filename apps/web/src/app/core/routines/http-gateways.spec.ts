import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Category } from './category';
import { Goal } from './goal';
import { HttpCategoriesGateway } from './http-categories-gateway';
import { HttpGoalsGateway } from './http-goals-gateway';
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
});

describe('HttpGoalsGateway', () => {
  it('lists goals from the API', () => {
    let received: readonly Goal[] = [];

    TestBed.inject(HttpGoalsGateway)
      .list()
      .subscribe((goals) => (received = goals));
    httpTesting.expectOne({ method: 'GET', url: '/api/goals' }).flush([WEEKLY_GOAL]);

    expect(received).toEqual([WEEKLY_GOAL]);
  });

  it('posts a new goal', () => {
    TestBed.inject(HttpGoalsGateway).create(WEEKLY_GOAL).subscribe();

    const request = httpTesting.expectOne({ method: 'POST', url: '/api/goals' });

    expect(request.request.body).toEqual(WEEKLY_GOAL);
    request.flush(WEEKLY_GOAL);
  });

  it('logs progress on the goal, escaping its id', () => {
    let received: Goal | undefined;

    TestBed.inject(HttpGoalsGateway)
      .logProgress('g 1')
      .subscribe((goal) => (received = goal));
    httpTesting
      .expectOne({ method: 'POST', url: '/api/goals/g%201/progress' })
      .flush({ ...WEEKLY_GOAL, done: 1 });

    expect(received?.done).toBe(1);
  });
});
