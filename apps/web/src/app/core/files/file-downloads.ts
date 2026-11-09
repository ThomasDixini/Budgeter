import { Injectable } from '@angular/core';

/**
 * Hands a file to the browser to save in the downloads folder; kept apart so tests can swap it for a
 * fake that only records the file.
 */
@Injectable({ providedIn: 'root' })
export class FileDownloads {
  /** @example inject(FileDownloads).save('budgeter-backup.db', blob) */
  save(fileName: string, content: Blob): void {
    const address = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = address;
    link.download = fileName;
    link.click();
    // Released on the next turn: some browsers start reading the file only after click() returns.
    setTimeout(() => URL.revokeObjectURL(address));
  }
}
