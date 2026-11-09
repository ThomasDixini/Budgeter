import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BackupDownload } from './backup-gateway';
import { HttpBackupGateway } from './http-backup-gateway';

let httpTesting: HttpTestingController;

beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), HttpBackupGateway],
  });
  httpTesting = TestBed.inject(HttpTestingController);
});

afterEach(() => httpTesting.verify());

describe('HttpBackupGateway', () => {
  it('downloads the database named as the API names it', () => {
    const database = new Blob(['SQLite format 3']);
    let received: BackupDownload | undefined;

    TestBed.inject(HttpBackupGateway)
      .download()
      .subscribe((backup) => (received = backup));
    httpTesting
      .expectOne({ method: 'GET', url: '/api/backup' })
      .flush(database, { headers: { 'Content-Disposition': 'attachment; filename=b-2026.db' } });

    expect(received).toEqual({ fileName: 'b-2026.db', content: database });
  });

  it('sends the chosen file as the raw body of the restore', () => {
    const backup = new Blob(['SQLite format 3']);
    let isDone = false;

    TestBed.inject(HttpBackupGateway)
      .restore(backup)
      .subscribe(() => (isDone = true));
    const request = httpTesting.expectOne({ method: 'POST', url: '/api/backup/restore' });
    request.flush('', { status: 204, statusText: 'No Content' });

    expect([request.request.body, request.request.headers.get('Content-Type'), isDone]).toEqual([
      backup,
      'application/vnd.sqlite3',
      true,
    ]);
  });
});
