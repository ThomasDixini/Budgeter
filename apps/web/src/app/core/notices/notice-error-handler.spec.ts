import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NoticeErrorHandler, describeFailure } from './notice-error-handler';
import { UserNotices } from './user-notices';

describe('describeFailure', () => {
  it('asks to check the connection when the server was not reached', () => {
    expect(describeFailure(new HttpErrorResponse({ status: 0 }))).toBe(
      "Couldn't reach the server. Check your connection and try again.",
    );
  });

  it('passes on the reason the API gave for refusing a change', () => {
    const refused = new HttpErrorResponse({
      status: 400,
      error: { detail: 'Expected weekdays no other routine uses, received [4]' },
    });

    expect(describeFailure(refused)).toBe(
      'Not saved: Expected weekdays no other routine uses, received [4]',
    );
  });

  it('speaks of a server problem when there is no reason to pass on', () => {
    expect(
      describeFailure(new HttpErrorResponse({ status: 500, error: { detail: 'trace' } })),
    ).toBe('The server ran into a problem. Try again in a moment.');
  });

  it('stays general for an error that is not about the API', () => {
    expect(describeFailure(new Error('bug'))).toBe(
      'Something went wrong. Reload the page if it keeps happening.',
    );
  });
});

describe('NoticeErrorHandler', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: ErrorHandler, useClass: NoticeErrorHandler }],
    });
  });

  // Regression: a refused change was rolled back with the reason only in the console.
  it('shows the user what an error means for them', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    TestBed.inject(ErrorHandler).handleError(new HttpErrorResponse({ status: 0 }));

    expect(TestBed.inject(UserNotices).message()).toContain("Couldn't reach the server");
  });

  it('still logs the error for whoever debugs it', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = new Error('bug');

    TestBed.inject(ErrorHandler).handleError(error);

    expect(log).toHaveBeenCalled();
  });
});
