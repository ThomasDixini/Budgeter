import { Provider } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { BackupDownload, BackupGateway } from './backup-gateway';

/**
 * Binds the backup port to a fake, for specs of screens that show the header.
 * @example TestBed.configureTestingModule({ providers: [provideFakeBackupGateway()] })
 */
export function provideFakeBackupGateway(): Provider {
  return { provide: BackupGateway, useValue: new FakeBackupGateway() };
}

/** Test double answering synchronously; set `failure` to make the next calls fail. */
export class FakeBackupGateway extends BackupGateway {
  failure: unknown;
  readonly restored: Blob[] = [];

  constructor(
    private readonly stored: BackupDownload = {
      fileName: 'orbit-backup-2026-11-09-153000.db',
      content: new Blob(['SQLite format 3']),
    },
  ) {
    super();
  }

  override download(): Observable<BackupDownload> {
    return this.answer(this.stored);
  }

  override restore(backup: Blob): Observable<void> {
    if (this.failure === undefined) this.restored.push(backup);
    return this.answer(undefined);
  }

  private answer<TValue>(value: TValue): Observable<TValue> {
    return this.failure === undefined ? of(value) : throwError(() => this.failure);
  }
}
