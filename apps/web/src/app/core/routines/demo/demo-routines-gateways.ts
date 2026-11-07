import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { BlockOutcomesGateway } from '../block-outcomes-gateway';
import { CategoriesGateway } from '../categories-gateway';
import { Category } from '../category';
import { BlockOutcome } from '../day-plan';
import { Goal, GoalChanges } from '../goal';
import { GoalsGateway } from '../goals-gateway';
import { Routine } from '../routine';
import { RoutinesGateway } from '../routines-gateway';
import { Task } from '../task';
import { TasksGateway } from '../tasks-gateway';
import { DemoRoutines, upsertById } from './demo-routines';

function unknownGoal(goalId: string): Observable<never> {
  return throwError(() => new Error(`Expected a known goal id, received "${goalId}"`));
}

/** Routines and their blocks kept in memory by the demo. */
@Injectable()
export class DemoRoutinesGateway extends RoutinesGateway {
  private readonly demo = inject(DemoRoutines);

  override list(): Observable<readonly Routine[]> {
    return of(this.demo.routines);
  }

  override save(routine: Routine): Observable<Routine> {
    this.demo.routines = upsertById(this.demo.routines, routine);
    return of(routine);
  }

  override delete(routineId: string): Observable<void> {
    this.demo.routines = this.demo.routines.filter((routine) => routine.id !== routineId);
    return of(undefined);
  }
}

/** Categories kept in memory by the demo; deleting one drops its goals and frees its blocks and tasks. */
@Injectable()
export class DemoCategoriesGateway extends CategoriesGateway {
  private readonly demo = inject(DemoRoutines);

  override list(): Observable<readonly Category[]> {
    return of(this.demo.categories);
  }

  override create(category: Category): Observable<Category> {
    this.demo.categories = upsertById(this.demo.categories, category);
    return of(category);
  }

  override update(category: Category): Observable<Category> {
    this.demo.categories = upsertById(this.demo.categories, category);
    return of(category);
  }

  override delete(categoryId: string): Observable<void> {
    this.demo.categories = this.demo.categories.filter((category) => category.id !== categoryId);
    this.demo.goals = this.demo.goals.filter((goal) => goal.categoryId !== categoryId);
    this.demo.routines = this.demo.routines.map((routine) => ({
      ...routine,
      blocks: routine.blocks.map((block) =>
        block.categoryId === categoryId ? { ...block, categoryId: undefined } : block,
      ),
    }));
    this.demo.tasks = this.demo.tasks.map((task) =>
      task.categoryId === categoryId ? { ...task, categoryId: undefined } : task,
    );
    return of(undefined);
  }
}

/** Goals kept in memory by the demo, with progress worked out from the blocks completed. */
@Injectable()
export class DemoGoalsGateway extends GoalsGateway {
  private readonly demo = inject(DemoRoutines);

  override list(isoDay: string): Observable<readonly Goal[]> {
    return of(this.demo.goals.map((goal) => this.demo.withProgress(goal, isoDay)));
  }

  override create(goal: Goal, isoDay: string): Observable<Goal> {
    this.demo.goals = upsertById(this.demo.goals, goal);
    return of(this.demo.withProgress(goal, isoDay));
  }

  override update(goalId: string, changes: GoalChanges, isoDay: string): Observable<Goal> {
    const goal = this.demo.goals.find((candidate) => candidate.id === goalId);
    if (goal === undefined) return unknownGoal(goalId);
    const edited = { ...goal, ...changes };
    this.demo.goals = upsertById(this.demo.goals, edited);
    return of(this.demo.withProgress(edited, isoDay));
  }

  override delete(goalId: string): Observable<void> {
    this.demo.goals = this.demo.goals.filter((goal) => goal.id !== goalId);
    return of(undefined);
  }

  override setAchievement(goalId: string, isoDay: string, isAchieved: boolean): Observable<Goal> {
    const goal = this.demo.goals.find((candidate) => candidate.id === goalId);
    if (goal === undefined) return unknownGoal(goalId);
    const marked = { ...goal, achievedOn: isAchieved ? (goal.achievedOn ?? isoDay) : undefined };
    this.demo.goals = upsertById(this.demo.goals, marked);
    return of(this.demo.withProgress(marked, isoDay));
  }
}

/** Tasks and the days they were done, kept in memory by the demo. */
@Injectable()
export class DemoTasksGateway extends TasksGateway {
  private readonly demo = inject(DemoRoutines);

  override list(): Observable<readonly Task[]> {
    return of(this.demo.tasks);
  }

  override save(task: Task): Observable<Task> {
    this.demo.tasks = upsertById(this.demo.tasks, task);
    return of(task);
  }

  override delete(taskId: string): Observable<void> {
    this.demo.tasks = this.demo.tasks.filter((task) => task.id !== taskId);
    return of(undefined);
  }

  override completedOn(isoDay: string): Observable<readonly string[]> {
    return of(this.demo.completedTasksOn(isoDay));
  }

  override setDone(taskId: string, isoDay: string, isDone: boolean): Observable<void> {
    this.demo.setTaskDone(taskId, isoDay, isDone);
    return of(undefined);
  }
}

/** Blocks completed or skipped each day, kept in memory by the demo. */
@Injectable()
export class DemoBlockOutcomesGateway extends BlockOutcomesGateway {
  private readonly demo = inject(DemoRoutines);

  override list(isoDay: string): Observable<readonly BlockOutcome[]> {
    return of(this.demo.outcomesOn(isoDay));
  }

  override record(isoDay: string, outcome: BlockOutcome): Observable<BlockOutcome> {
    this.demo.recordOutcome(isoDay, outcome);
    return of(outcome);
  }

  override undo(isoDay: string, routineId: string, blockId: string): Observable<void> {
    this.demo.removeOutcome(isoDay, routineId, blockId);
    return of(undefined);
  }
}
