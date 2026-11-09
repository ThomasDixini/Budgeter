import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { BackupMenuPage } from './pages/backup.page';

let backup: BackupMenuPage;

test.beforeEach(async ({ page }) => {
  backup = new BackupMenuPage(page);
  await backup.open();
});

/*
 * Restoring a real backup replaces the database every other test is writing to at the same time, so
 * that round trip is covered by the API's integration tests; here the UI flow stops before it.
 */
test.describe('backup of all the data', () => {
  test('downloads the whole database as a dated SQLite file', async () => {
    const download = await backup.download();

    expect(download.suggestedFilename()).toMatch(/^budgeter-backup-\d{4}-\d{2}-\d{2}-\d{6}\.db$/);
    const content = await readFile(await download.path());
    expect(content.subarray(0, 15).toString('latin1')).toBe('SQLite format 3');
  });

  test('refuses a file that is not a backup and keeps the data', async () => {
    await backup.choose('notes.db', Buffer.from('just some notes'));
    await expect(backup.warning).toContainText('notes.db');

    await backup.replaceButton.click();

    await expect(backup.notice).toContainText(
      'That file is not a Budgeter backup. Nothing was changed.',
    );
  });
});
