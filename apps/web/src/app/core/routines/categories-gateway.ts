import { Observable } from 'rxjs';
import { Category } from './category';

/**
 * Port to wherever categories are stored. The store depends on this class only;
 * `app.config.ts` binds it to the HTTP adapter and tests to a fake.
 */
export abstract class CategoriesGateway {
  /** Every category, in creation order. */
  abstract list(): Observable<readonly Category[]>;

  /** Saves a category built on the client; answers with the stored (normalized) version. */
  abstract create(category: Category): Observable<Category>;

  /** Renames and recolors a category; answers with the stored (normalized) version. */
  abstract update(category: Category): Observable<Category>;

  /** Deletes a category and its goals; its blocks and tasks stay, without a category. */
  abstract delete(categoryId: string): Observable<void>;
}
