import { FALLBACK_BACKUP_FILE_NAME, backupFileName } from './backup-file-name';

describe('backupFileName', () => {
  it('reads the plain file name the API sends', () => {
    const header =
      "attachment; filename=budgeter-backup-2026-11-09-153000.db; filename*=UTF-8''budgeter-backup-2026-11-09-153000.db";

    expect(backupFileName(header)).toBe('budgeter-backup-2026-11-09-153000.db');
  });

  it('reads a quoted file name', () => {
    expect(backupFileName('attachment; filename="my backup.db"')).toBe('my backup.db');
  });

  it('falls back to a generic name without the header', () => {
    expect(backupFileName(null)).toBe(FALLBACK_BACKUP_FILE_NAME);
  });

  it('falls back to a generic name when the header names no file', () => {
    expect(backupFileName('attachment')).toBe(FALLBACK_BACKUP_FILE_NAME);
  });
});
