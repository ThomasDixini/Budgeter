import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BackupGateway } from '../../core/backups/backup-gateway';
import { FakeBackupGateway } from '../../core/backups/fake-backup-gateway';
import { FileDownloads } from '../../core/files/file-downloads';
import { PageReloader } from '../../core/i18n/page-reloader';
import { UserNotices } from '../../core/notices/user-notices';
import { BackupMenu, NOT_A_BACKUP_NOTICE } from './backup-menu';

/** Records the files instead of handing them to the browser. */
class FakeFileDownloads extends FileDownloads {
  readonly saved: string[] = [];

  override save(fileName: string): void {
    this.saved.push(fileName);
  }
}

/** Counts the reloads instead of leaving the page. */
class FakePageReloader extends PageReloader {
  reloads = 0;

  override reload(): void {
    this.reloads++;
  }
}

interface Rendered {
  readonly fixture: ComponentFixture<BackupMenu>;
  readonly backups: FakeBackupGateway;
  readonly downloads: FakeFileDownloads;
  readonly reloader: FakePageReloader;
}

function render(): Rendered {
  const backups = new FakeBackupGateway();
  const downloads = new FakeFileDownloads();
  const reloader = new FakePageReloader();
  TestBed.configureTestingModule({
    providers: [
      { provide: BackupGateway, useValue: backups },
      { provide: FileDownloads, useValue: downloads },
      { provide: PageReloader, useValue: reloader },
    ],
  });
  const fixture = TestBed.createComponent(BackupMenu);
  fixture.detectChanges();
  return { fixture, backups, downloads, reloader };
}

function element(fixture: ComponentFixture<BackupMenu>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function open(fixture: ComponentFixture<BackupMenu>): void {
  element(fixture).querySelector<HTMLButtonElement>('.toggle')!.click();
  fixture.detectChanges();
}

function clickAction(fixture: ComponentFixture<BackupMenu>, text: string): void {
  const actions = [...element(fixture).querySelectorAll<HTMLButtonElement>('button.action')];
  actions.find((action) => action.textContent?.trim() === text)!.click();
  fixture.detectChanges();
}

function chooseFile(fixture: ComponentFixture<BackupMenu>, name: string): void {
  const input = element(fixture).querySelector<HTMLInputElement>('input[type=file]')!;
  // jsdom has no DataTransfer to build a FileList, so the list is handed over as the browser would.
  Object.defineProperty(input, 'files', {
    value: [new File(['SQLite format 3'], name)],
    configurable: true,
  });
  input.dispatchEvent(new Event('change'));
  fixture.detectChanges();
}

describe('BackupMenu', () => {
  it('keeps the panel closed until the button is clicked', () => {
    const { fixture } = render();

    const toggle = element(fixture).querySelector('.toggle')!;

    expect([
      toggle.getAttribute('aria-expanded'),
      element(fixture).querySelector('.panel'),
    ]).toEqual(['false', null]);
  });

  it('saves the downloaded backup under the name the API gave it', () => {
    const { fixture, downloads } = render();
    open(fixture);

    clickAction(fixture, 'Download backup');

    expect([downloads.saved, element(fixture).querySelector('.panel')]).toEqual([
      ['budgeter-backup-2026-11-09-153000.db'],
      null,
    ]);
  });

  it('asks before replacing the data with the chosen file', () => {
    const { fixture, backups } = render();
    open(fixture);

    chooseFile(fixture, 'old.db');

    expect(element(fixture).querySelector('.warning')?.textContent).toContain('old.db');
    expect(backups.restored).toEqual([]);
  });

  it('restores the confirmed file and starts the page again with the data', () => {
    const { fixture, backups, reloader } = render();
    open(fixture);
    chooseFile(fixture, 'old.db');

    clickAction(fixture, 'Replace my data');

    expect([backups.restored.map((file) => (file as File).name), reloader.reloads]).toEqual([
      ['old.db'],
      1,
    ]);
  });

  it('drops the chosen file on cancel', () => {
    const { fixture, backups } = render();
    open(fixture);
    chooseFile(fixture, 'old.db');

    clickAction(fixture, 'Cancel');

    expect([element(fixture).querySelector('.warning'), backups.restored]).toEqual([null, []]);
  });

  it('tells that a file that is not a backup changed nothing', () => {
    const { fixture, backups, reloader } = render();
    backups.failure = new HttpErrorResponse({ status: 400 });
    open(fixture);
    chooseFile(fixture, 'photo.jpg');

    clickAction(fixture, 'Replace my data');

    expect([TestBed.inject(UserNotices).message(), reloader.reloads]).toEqual([
      NOT_A_BACKUP_NOTICE,
      0,
    ]);
  });

  it('tells when the server cannot be reached for the download', () => {
    const { fixture, backups } = render();
    backups.failure = new HttpErrorResponse({ status: 0 });
    open(fixture);

    clickAction(fixture, 'Download backup');

    expect(TestBed.inject(UserNotices).message()).toContain("Couldn't reach the server");
  });

  it('closes when clicking elsewhere on the page', () => {
    const { fixture } = render();
    open(fixture);

    document.body.click();
    fixture.detectChanges();

    expect(element(fixture).querySelector('.panel')).toBeNull();
  });
});
