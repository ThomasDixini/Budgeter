import { TestBed } from '@angular/core/testing';
import { Observable, Subject, defer, of } from 'rxjs';
import { Category } from './category';
import { CategoryCreations } from './category-creations';

const LANGUAGES: Category = { id: 'languages', name: 'Languages', color: '#86EFAC' };

interface Probe {
  readonly sent: string[];
  dropped: boolean;
  readonly send: () => Observable<string>;
  readonly drop: () => void;
}

/** A request that records whether it was sent, and an undo that records whether it ran. */
function probe(): Probe {
  const result: Probe = {
    sent: [],
    dropped: false,
    send: () => {
      result.sent.push('sent');
      return of('saved');
    },
    drop: () => {
      result.dropped = true;
    },
  };
  return result;
}

describe('CategoryCreations', () => {
  let creations: CategoryCreations;

  beforeEach(() => {
    creations = TestBed.inject(CategoryCreations);
  });

  it('sends at once when no category is being created', () => {
    const request = probe();

    creations.whenSaved(['study', undefined], request.send, request.drop).subscribe();

    expect(request.sent).toEqual(['sent']);
  });

  it('waits for a category still being created', () => {
    const creation = new Subject<Category>();
    creations.track('languages', creation).subscribe();
    const request = probe();

    creations.whenSaved(['languages'], request.send, request.drop).subscribe();
    expect(request.sent).toEqual([]);
    creation.next(LANGUAGES);
    creation.complete();

    expect(request.sent).toEqual(['sent']);
  });

  it('runs the undo instead of the request when the category could not be saved', () => {
    const creation = new Subject<Category>();
    creations.track('languages', creation).subscribe({ error: () => undefined });
    const request = probe();

    creations.whenSaved(['languages'], request.send, request.drop).subscribe();
    creation.error(new Error('offline'));

    expect([request.sent, request.dropped]).toEqual([[], true]);
  });

  it('sends the category once, however many requests wait for it', () => {
    let sends = 0;
    const reply = new Subject<Category>();
    const creation = defer(() => {
      sends += 1;
      return reply;
    });
    creations.track('languages', creation).subscribe();

    creations.whenSaved(['languages'], probe().send, probe().drop).subscribe();
    creations.whenSaved(['languages'], probe().send, probe().drop).subscribe();

    expect(sends).toBe(1);
  });

  it('forgets a creation once it is settled', () => {
    const creation = new Subject<Category>();
    creations.track('languages', creation).subscribe();
    creation.next(LANGUAGES);
    creation.complete();
    const request = probe();

    creations.whenSaved(['languages'], request.send, request.drop).subscribe();

    expect(request.sent).toEqual(['sent']);
  });
});
