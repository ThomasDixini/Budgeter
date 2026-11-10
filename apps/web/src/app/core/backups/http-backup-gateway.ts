import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { backupFileName } from './backup-file-name';
import { BackupDownload, BackupGateway } from './backup-gateway';

const BACKUP_URL = '/api/backup';
const RESTORE_URL = '/api/backup/restore';
const SQLITE_HEADERS = new HttpHeaders({ 'Content-Type': 'application/vnd.sqlite3' });

/** The backup of the Orbit API: its whole SQLite database. */
@Injectable()
export class HttpBackupGateway extends BackupGateway {
  private readonly httpClient = inject(HttpClient);

  override download(): Observable<BackupDownload> {
    return this.httpClient.get(BACKUP_URL, { observe: 'response', responseType: 'blob' }).pipe(
      map((response) => ({
        fileName: backupFileName(response.headers.get('Content-Disposition')),
        content: response.body ?? new Blob(),
      })),
    );
  }

  override restore(backup: Blob): Observable<void> {
    return this.httpClient
      .post(RESTORE_URL, backup, { headers: SQLITE_HEADERS, responseType: 'text' })
      .pipe(map(() => undefined));
  }
}
