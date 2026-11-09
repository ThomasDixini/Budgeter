/** Used when the server's answer does not name the file. */
export const FALLBACK_BACKUP_FILE_NAME = 'budgeter-backup.db';

const QUOTED_OR_PLAIN_FILE_NAME = /filename="?([^";]+)"?/i;

/**
 * The file name a `Content-Disposition` header gives, or a generic one when it gives none.
 * @example backupFileName('attachment; filename=budgeter-backup-2026-11-09-153000.db') // 'budgeter-backup-2026-11-09-153000.db'
 */
export function backupFileName(contentDisposition: string | null): string {
  const match = QUOTED_OR_PLAIN_FILE_NAME.exec(contentDisposition ?? '');
  return match?.[1]?.trim() || FALLBACK_BACKUP_FILE_NAME;
}
