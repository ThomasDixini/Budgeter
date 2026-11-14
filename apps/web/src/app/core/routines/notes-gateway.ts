import { Observable } from 'rxjs';
import { Note, NoteDraft, NoteStatus } from './notes';

/** Port to the stored notes. */
export abstract class NotesGateway {
  /** Every note, most recently updated first. */
  abstract list(): Observable<readonly Note[]>;

  /** Creates the note as open, or edits it keeping its status; answers the stored note. */
  abstract save(id: string, draft: NoteDraft): Observable<Note>;

  /** Moves the note to another status and answers the stored note. */
  abstract setStatus(id: string, status: NoteStatus): Observable<Note>;

  /** Removes the note; an unknown id is ignored. */
  abstract delete(id: string): Observable<void>;
}
