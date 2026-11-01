import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler, Injectable, inject } from '@angular/core';
import { UserNotices } from './user-notices';

/**
 * Logs every error, as Angular's handler does, and tells the user in plain words what it means for
 * them. Stores already undo a change the API refused; without this the change just vanished.
 */
@Injectable()
export class NoticeErrorHandler extends ErrorHandler {
  private readonly notices = inject(UserNotices);

  override handleError(error: unknown): void {
    super.handleError(error);
    this.notices.show(describeFailure(error));
  }
}

/**
 * What a failure means for the user: no connection, a server problem, or the API's own reason for
 * refusing a change.
 * @example describeFailure(new HttpErrorResponse({ status: 0 })) // "Couldn't reach the server. …"
 */
export function describeFailure(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return 'Something went wrong. Reload the page if it keeps happening.';
  }
  if (error.status === 0) return "Couldn't reach the server. Check your connection and try again.";
  const detail = problemDetail(error.error);
  if (error.status >= 500 || detail === undefined) {
    return 'The server ran into a problem. Try again in a moment.';
  }
  return `Not saved: ${detail}`;
}

/** The `detail` of a problem-details body, which the API fills with the broken rule. */
function problemDetail(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || !('detail' in body)) return undefined;
  return typeof body.detail === 'string' ? body.detail : undefined;
}
