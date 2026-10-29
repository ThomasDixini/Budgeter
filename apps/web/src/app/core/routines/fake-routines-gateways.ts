import { Provider } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { IdGenerator } from '../ids/id-generator';
import { SequentialIdGenerator } from '../ids/sequential-id-generator';
import { CategoriesGateway } from './categories-gateway';
import { Category } from './category';
import { Goal, GoalChanges } from './goal';
import { GoalsGateway } from './goals-gateway';
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
  readonly updated: Category[] = [];
  readonly deleted: string[] = [];

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

  override update(category: Category): Observable<Category> {
    if (this.failure !== undefined) return throwError(() => this.failure);
    this.updated.push(category);
    return of(category);
  }

  override delete(categoryId: string): Observable<void> {
    if (this.failure !== undefined) return throwError(() => this.failure);
    this.deleted.push(categoryId);
    return of(undefined);
  }
}

/** Test double answering synchronously from memory; set `failure` to make the next calls fail. */
export class FakeGoalsGateway extends GoalsGateway {
  failure: Error | undefined;
  readonly saved: Goal[] = [];
  readonly updated: { readonly goalId: string; readonly changes: GoalChanges }[] = [];
  readonly deleted: string[] = [];
  /** Calls to `setAchievement`, in order. */
  readonly achievements: {
    readonly goalId: string;
    readonly isoDay: string;
    readonly isAchieved: boolean;
  }[] = [];
  /** Days `list` was asked for, in order. */
  readonly listedDays: string[] = [];
  /** Goals as they stood on given days, answered by `list` for those days instead of the current ones. */
  readonly goalsOnDay = new Map<string, readonly Goal[]>();
  private readonly progress = new Map<string, number>();
  /** Days objectives were marked achieved on; null once a mark is taken back. */
  private readonly achievedOn = new Map<string, string | null>();

  constructor(private readonly goals: readonly Goal[] = SAMPLE_GOALS) {
    super();
  }

  override list(isoDay: string): Observable<readonly Goal[]> {
    this.listedDays.push(isoDay);
    if (this.failure !== undefined) return throwError(() => this.failure);
    return of(this.goalsOnDay.get(isoDay) ?? this.known());
  }

  /** Sets the progress the API would report for a goal, as completed blocks would. */
  setDone(goalId: string, done: number): void {
    this.progress.set(goalId, done);
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
    return of({ ...goal, ...changes });
  }

  override delete(goalId: string): Observable<void> {
    this.deleted.push(goalId);
    return this.failure === undefined ? of(undefined) : throwError(() => this.failure);
  }

  override setAchievement(goalId: string, isoDay: string, isAchieved: boolean): Observable<Goal> {
    this.achievements.push({ goalId, isoDay, isAchieved });
    if (this.failure !== undefined) return throwError(() => this.failure);
    const goal = this.find(goalId);
    if (goal === undefined) return throwError(() => unknownGoal(goalId));
    if (!isAchieved) this.achievedOn.set(goalId, null);
    else if (!this.achievedOn.get(goalId)) this.achievedOn.set(goalId, goal.achievedOn ?? isoDay);
    return of(this.find(goalId) ?? goal);
  }

  private known(): Goal[] {
    return [...this.goals, ...this.saved].map((goal) => this.withProgress(goal));
  }

  private withProgress(goal: Goal): Goal {
    if (goal.type === 'frequency')
      return { ...goal, done: this.progress.get(goal.id) ?? goal.done };
    const marked = this.achievedOn.get(goal.id);
    const achievedOn = marked === undefined ? goal.achievedOn : (marked ?? undefined);
    return achievedOn === undefined
      ? { ...goal, achievedOn: undefined, done: 0 }
      : { ...goal, achievedOn, done: goal.target };
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
