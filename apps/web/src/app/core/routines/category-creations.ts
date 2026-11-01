import { Injectable } from '@angular/core';
import {
  EMPTY,
  Observable,
  catchError,
  concatMap,
  finalize,
  forkJoin,
  map,
  of,
  shareReplay,
  take,
} from 'rxjs';
import { Category } from './category';

/**
 * Categories still being created. The API refuses a goal, task or routine block of a category it does
 * not know yet, and requests can overtake each other, so whatever uses a new category waits for it.
 */
@Injectable({ providedIn: 'root' })
export class CategoryCreations {
  /** Whether each creation in flight was saved, by category id; settled ones are dropped. */
  private readonly pending = new Map<string, Observable<boolean>>();

  /**
   * Remembers a creation until it settles. Subscribe to the returned observable instead of the given
   * one: it is shared with whoever waits, so the category is sent once.
   * @example creations.track(category.id, gateway.create(category)).subscribe(...)
   */
  track(categoryId: string, creation: Observable<Category>): Observable<Category> {
    const shared = creation.pipe(shareReplay(1));
    this.pending.set(
      categoryId,
      shared.pipe(
        map(() => true),
        catchError(() => of(false)),
      ),
    );
    return shared.pipe(finalize(() => this.pending.delete(categoryId)));
  }

  /**
   * Sends the request once every given category is saved (at once when none is being created). When
   * one could not be saved, the request is never sent: `onDropped` undoes what was shown instead, and
   * the observable completes empty, since the failed creation already reported its error.
   * @example creations.whenSaved([goal.categoryId], () => gateway.create(goal), () => removeGoal())
   */
  whenSaved<TResult>(
    categoryIds: readonly (string | undefined)[],
    request: () => Observable<TResult>,
    onDropped: () => void,
  ): Observable<TResult> {
    const waits = categoryIds
      .filter((categoryId): categoryId is string => categoryId !== undefined)
      .map((categoryId) => this.saved(categoryId));
    return (waits.length === 0 ? of([]) : forkJoin(waits)).pipe(
      concatMap((results) => {
        if (results.every(Boolean)) return request();
        onDropped();
        return EMPTY;
      }),
    );
  }

  private saved(categoryId: string): Observable<boolean> {
    return (this.pending.get(categoryId) ?? of(true)).pipe(take(1));
  }
}
