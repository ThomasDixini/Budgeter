import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CategoriesGateway } from './categories-gateway';
import { Category } from './category';

const CATEGORIES_URL = '/api/categories';

function categoryUrl(categoryId: string): string {
  return `${CATEGORIES_URL}/${encodeURIComponent(categoryId)}`;
}

/** Categories stored by the Budgeter API. */
@Injectable()
export class HttpCategoriesGateway extends CategoriesGateway {
  private readonly httpClient = inject(HttpClient);

  override list(): Observable<readonly Category[]> {
    return this.httpClient.get<readonly Category[]>(CATEGORIES_URL);
  }

  override create(category: Category): Observable<Category> {
    return this.httpClient.post<Category>(CATEGORIES_URL, category);
  }

  override update(category: Category): Observable<Category> {
    const { name, color } = category;
    return this.httpClient.put<Category>(categoryUrl(category.id), { name, color });
  }

  override delete(categoryId: string): Observable<void> {
    return this.httpClient.delete<void>(categoryUrl(categoryId));
  }
}
