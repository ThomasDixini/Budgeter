import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Note, NoteDraft, NoteStatus } from './notes';
import { NotesGateway } from './notes-gateway';

const NOTES_URL = '/api/notes';

/** Notes stored by the Orbit API. */
@Injectable()
export class HttpNotesGateway extends NotesGateway {
  private readonly httpClient = inject(HttpClient);

  override list(): Observable<readonly Note[]> {
    return this.httpClient.get<readonly Note[]>(NOTES_URL);
  }

  override save(id: string, draft: NoteDraft): Observable<Note> {
    return this.httpClient.put<Note>(noteUrl(id), draft);
  }

  override setStatus(id: string, status: NoteStatus): Observable<Note> {
    return this.httpClient.put<Note>(`${noteUrl(id)}/status`, { status });
  }

  override delete(id: string): Observable<void> {
    return this.httpClient.delete<void>(noteUrl(id));
  }
}

function noteUrl(id: string): string {
  return `${NOTES_URL}/${encodeURIComponent(id)}`;
}
