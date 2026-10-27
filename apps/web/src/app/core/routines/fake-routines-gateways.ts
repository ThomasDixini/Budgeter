import { Provider } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { IdGenerator } from '../ids/id-generator';
import { SequentialIdGenerator } from '../ids/sequential-id-generator';
import { CategoriesGateway } from './categories-gateway';
import { Category } from './category';
import { Goal } from './goal';
import { GoalsGateway } from './goals-gateway';
import { Routine } from './routine';
import { RoutinesGateway } from './routines-gateway';
import { FakeTasksGateway } from './fake-tasks-gateway';
import { SAMPLE_CATEGORIES, SAMPLE_GOALS, SAMPLE_ROUTINES } from './sample-routines';
import { TasksGateway } from './tasks-gateway';

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

/** Test double answering synchronously from memory; set `failure` to make the next calls fail. */
export class FakeRoutinesGateway extends RoutinesGateway {
  failure: Error | undefined;
  readonly saved: Routine[] = [];
  readonly deleted: string[] = [];

  constructor(private readonly routines: readonly Routine[] = SAMPLE_ROUTINES) {
    super();
  }

  override list(): Observable<readonly Routine[]> {
    return this.failure === undefined ? of(this.routines) : throwError(() => this.failure);
  }

  override save(routine: Routine): Observable<Routine> {
    if (this.failure !== undefined) return throwError(() => this.failure);
    this.saved.push(routine);
    return of(routine);
  }

  override delete(routineId: string): Observable<void> {
    if (this.failure !== undefined) return throwError(() => this.failure);
    this.deleted.push(routineId);
    return of(undefined);
  }
}

/**
 * Providers that seed the Routines & Goals store with the sample content and predictable ids.
 * @example TestBed.configureTestingModule({ providers: [provideFakeRoutinesGateways()] })
 */
export function provideFakeRoutinesGateways(
  categories = new FakeCategoriesGateway(),
  goals = new FakeGoalsGateway(),
  routines = new FakeRoutinesGateway(),
  tasks = new FakeTasksGateway(),
): Provider[] {
  return [
    { provide: CategoriesGateway, useValue: categories },
    { provide: GoalsGateway, useValue: goals },
    { provide: RoutinesGateway, useValue: routines },
    { provide: TasksGateway, useValue: tasks },
    { provide: IdGenerator, useValue: new SequentialIdGenerator() },
  ];
}
