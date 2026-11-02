import { Injectable, signal } from '@angular/core';

/** The message the user should see about something that went wrong, kept until it is dismissed. */
@Injectable({ providedIn: 'root' })
export class UserNotices {
  private readonly current = signal<string | undefined>(undefined);

  readonly message = this.current.asReadonly();

  /**
   * Shows a message, replacing the one on screen.
   * @example inject(UserNotices).show("Couldn't reach the server.")
   */
  show(message: string): void {
    this.current.set(message);
  }

  /**
   * Hides the message.
   * @example inject(UserNotices).dismiss()
   */
  dismiss(): void {
    this.current.set(undefined);
  }
}
