import { Provider } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { IdGenerator } from '../ids/id-generator';
import { SequentialIdGenerator } from '../ids/sequential-id-generator';
import { CategoriesGateway } from './categories-gateway';
import { Category } from './category';
import { Goal } from './goal';
import { GoalsGateway } from './goals-gateway';
import { SAMPLE_CATEGORIES, SAMPLE_GOALS } from './sample-routines';

/** Test double answering synchronously from memory; set `failure` to make the next calls fail. */
export class FakeCategoriesGateway extends CategoriesGateway {
  failure: Error | undefined;
  readonly saved: Category[] = [];

  constructor(private readonly categories: readonly Category[] = SAMPLE_CATEGORIES) {
    super();
  }

  override list(): Observable<readonly Category[]> {
    return this.failure === undefined ? of(this.categories) : throwError(() => this.failure);
  }

  override create(category: Category): Observable<Category> {
    if (this.failure !== undefined) return throwError(() => this.failure);
    this.saved.push(category);
    return of(category);
  }
}

/** Test double answering synchronously from memory; set `failure` to make the next calls fail. */
export class FakeGoalsGateway extends GoalsGateway {
  failure: Error | undefined;
  readonly saved: Goal[] = [];

  constructor(private readonly goals: readonly Goal[] = SAMPLE_GOALS) {
    super();
  }

  override list(): Observable<readonly Goal[]> {
    return this.failure === undefined ? of(this.goals) : throwError(() => this.failure);
  }

  override create(goal: Goal): Observable<Goal> {
    if (this.failure !== undefined) return throwError(() => this.failure);
    this.saved.push(goal);
    return of(goal);
  }

  override logProgress(goalId: string): Observable<Goal> {
    if (this.failure !== undefined) return throwError(() => this.failure);
    const goal = [...this.goals, ...this.saved].find((candidate) => candidate.id === goalId);
    if (goal === undefined) {
      return throwError(() => new Error(`Expected a known goal id, received "${goalId}"`));
    }
    return of({ ...goal, done: Math.min(goal.target, goal.done + 1) });
  }
}

/**
 * Providers that seed the Routines & Goals store with the sample content and predictable ids.
 * @example TestBed.configureTestingModule({ providers: [provideFakeRoutinesGateways()] })
 */
export function provideFakeRoutinesGateways(
  categories = new FakeCategoriesGateway(),
  goals = new FakeGoalsGateway(),
): Provider[] {
  return [
    { provide: CategoriesGateway, useValue: categories },
    { provide: GoalsGateway, useValue: goals },
    { provide: IdGenerator, useValue: new SequentialIdGenerator() },
  ];
}
