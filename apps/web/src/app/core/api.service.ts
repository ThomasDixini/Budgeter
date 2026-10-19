import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly httpClient = inject(HttpClient);

  /** Fetches the hello message from the API health endpoint. */
  getHello(): Observable<string> {
    return this.httpClient.get('/api', { responseType: 'text' });
  }
}
