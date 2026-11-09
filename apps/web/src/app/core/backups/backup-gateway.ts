import { Observable } from 'rxjs';

/** A copy of all the data, ready to save on the device. */
export interface BackupDownload {
  readonly fileName: string;
  readonly content: Blob;
}

/**
 * Port to where all the data lives, as one file. `app.config.ts` binds it to the HTTP adapter and tests
 * to a fake.
 */
export abstract class BackupGateway {
  /** A copy of every module's data (finances, routines, goals, tasks and any later module). */
  abstract download(): Observable<BackupDownload>;

  /** Replaces all the data with the backup's; fails with a 400 when the file is not a backup. */
  abstract restore(backup: Blob): Observable<void>;
}
