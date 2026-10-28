import { Provider } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { IdGenerator } from '../ids/id-generator';
import { SequentialIdGenerator } from '../ids/sequential-id-generator';
import { CategoriesGateway } from './categories-gateway';
import { Category } from './category';
import { Goal, GoalChanges } from './goal';
import { GoalsGateway, ProgressEntry } from './goals-gateway';
import { Routine } from './routine';
import { RoutinesGateway } from './routines-gateway';
import { BlockOutcomesGateway } from './block-outcomes-gateway';
import { FakeBlockOutcomesGateway } from './fake-block-outcomes-gateway';
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
  readonly updated: { readonly goalId: string; readonly changes: GoalChanges }[] = [];
  readonly deleted: string[] = [];
  /** Entries sent to `logProgress`, in order. */
  readonly entries: ProgressEntry[] = [];
  /** Days `list` was asked for, in order. */
  readonly listedDays: string[] = [];
  /** Entry ids already counted, so repeating one does nothing, like the API. */
  private readonly counted = new Set<string>();
  private readonly progress = new Map<string, number>();

  constructor(private readonly goals: readonly Goal[] = SAMPLE_GOALS) {
    super();
  }

  override list(isoDay: string): Observable<readonly Goal[]> {
    this.listedDays.push(isoDay);
    return this.failure === undefined ? of(this.known()) : throwError(() => this.failure);
  }

  override create(goal: Goal): Observable<Goal> {
    if (this.failure !== undefined) return throwError(() => this.failure);
    this.saved.push(goal);
    return of(goal);
  }

  override update(goalId: string, changes: GoalChanges): Observable<Goal> {
    this.updated.push({ goalId, changes });
    const goal = this.find(goalId);
    if (this.failure !== undefined) return throwError(() => this.failure);
    if (goal === undefined) return throwError(() => unknownGoal(goalId));
    return of({ ...goal, ...changes, done: Math.min(goal.done, changes.target) });
  }

  override delete(goalId: string): Observable<void> {
    this.deleted.push(goalId);
    return this.failure === undefined ? of(undefined) : throwError(() => this.failure);
  }

  override logProgress(goalId: string, entry: ProgressEntry): Observable<Goal> {
    this.entries.push(entry);
    if (this.failure !== undefined) return throwError(() => this.failure);
    const goal = this.find(goalId);
    if (goal === undefined) return throwError(() => unknownGoal(goalId));
    if (!this.counted.has(entry.eventId)) {
      this.counted.add(entry.eventId);
      this.progress.set(
        goalId,
        Math.max(0, (this.progress.get(goalId) ?? goal.done) + entry.amount),
      );
    }
    return of({ ...goal, done: Math.min(goal.target, this.progress.get(goalId) ?? goal.done) });
  }

  private known(): Goal[] {
    return [...this.goals, ...this.saved].map((goal) => ({
      ...goal,
      done: Math.min(goal.target, this.progress.get(goal.id) ?? goal.done),
    }));
  }

  private find(goalId: string): Goal | undefined {
    return this.known().find((candidate) => candidate.id === goalId);
  }
}

function unknownGoal(goalId: string): Error {
  return new Error(`Expected a known goal id, received "${goalId}"`);
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
  blockOutcomes = new FakeBlockOutcomesGateway(),
): Provider[] {
  return [
    { provide: BlockOutcomesGateway, useValue: blockOutcomes },
    { provide: CategoriesGateway, useValue: categories },
    { provide: GoalsGateway, useValue: goals },
    { provide: RoutinesGateway, useValue: routines },
    { provide: TasksGateway, useValue: tasks },
    { provide: IdGenerator, useValue: new SequentialIdGenerator() },
  ];
}
