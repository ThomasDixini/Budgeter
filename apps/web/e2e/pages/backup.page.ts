import { Download, Locator, Page } from '@playwright/test';

/** Page object for the backup menu in the header, present on every screen. */
export class BackupMenuPage {
  readonly toggle: Locator;
  readonly downloadButton: Locator;
  readonly fileInput: Locator;
  readonly replaceButton: Locator;
  readonly warning: Locator;
  readonly notice: Locator;

  constructor(private readonly page: Page) {
    this.toggle = page.getByRole('button', { name: 'Backup', exact: true });
    this.downloadButton = page.getByRole('button', { name: 'Download backup' });
    this.fileInput = page.getByLabel('Restore from a backup');
    this.replaceButton = page.getByRole('button', { name: 'Replace my data' });
    this.warning = page.getByText('Restoring replaces all your data');
    this.notice = page.getByRole('alert');
  }

  /** Opens the home screen and the menu. */
  async open(): Promise<void> {
    await this.page.goto('/');
    await this.toggle.click();
  }

  /** Downloads the backup and hands back the file the browser received. */
  async download(): Promise<Download> {
    const download = this.page.waitForEvent('download');
    await this.downloadButton.click();
    return download;
  }

  /** Picks a file to restore, as the file dialog would. */
  async choose(name: string, content: Buffer): Promise<void> {
    await this.fileInput.setInputFiles({
      name,
      mimeType: 'application/octet-stream',
      buffer: content,
    });
  }
}
