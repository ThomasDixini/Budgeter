import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { BackupGateway } from '../../core/backups/backup-gateway';
import { FileDownloads } from '../../core/files/file-downloads';
import { PageReloader } from '../../core/i18n/page-reloader';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { describeFailure } from '../../core/notices/notice-error-handler';
import { UserNotices } from '../../core/notices/user-notices';

export const NOT_A_BACKUP_NOTICE = 'That file is not a Budgeter backup. Nothing was changed.';

/**
 * A header menu to download a copy of all the data and to put one back. A restore replaces every
 * module's data, so it waits for a second, explicit click; the page then starts again with the data.
 */
@Component({
  selector: 'app-backup-menu',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:click)': 'closeWhenOutside($event)', '(keydown.escape)': 'close()' },
  templateUrl: './backup-menu.html',
  styleUrl: './backup-menu.css',
})
export class BackupMenu {
  private readonly backups = inject(BackupGateway);
  private readonly downloads = inject(FileDownloads);
  private readonly reloader = inject(PageReloader);
  private readonly notices = inject(UserNotices);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly isOpen = signal(false);
  protected readonly isBusy = signal(false);
  protected readonly chosenFile = signal<File | undefined>(undefined);

  protected toggle(): void {
    if (this.isOpen()) this.close();
    else this.isOpen.set(true);
  }

  protected close(): void {
    this.isOpen.set(false);
    this.chosenFile.set(undefined);
  }

  protected closeWhenOutside(event: MouseEvent): void {
    const target = event.target;
    if (target instanceof Node && this.host.nativeElement.contains(target)) return;
    this.close();
  }

  protected download(): void {
    this.isBusy.set(true);
    this.backups.download().subscribe({
      next: (backup) => {
        this.downloads.save(backup.fileName, backup.content);
        this.isBusy.set(false);
        this.close();
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  protected choose(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.chosenFile.set(input.files?.[0]);
    // Cleared so picking the same file again after a cancel still fires a change.
    input.value = '';
  }

  protected restore(backup: File): void {
    this.isBusy.set(true);
    this.backups.restore(backup).subscribe({
      next: () => this.reloader.reload(),
      error: (error: unknown) => this.fail(error),
    });
  }

  private fail(error: unknown): void {
    this.isBusy.set(false);
    this.close();
    const isNotABackup = error instanceof HttpErrorResponse && error.status === 400;
    this.notices.show(isNotABackup ? NOT_A_BACKUP_NOTICE : describeFailure(error));
  }
}
