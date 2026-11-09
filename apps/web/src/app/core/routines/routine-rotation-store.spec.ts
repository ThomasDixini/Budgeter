import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { FakeRoutineRotationGateway } from './fake-routine-rotation-gateway';
import { NO_ROTATION, RoutineRotation } from './routine-rotation';
import { RoutineRotationGateway } from './routine-rotation-gateway';
import { RoutineRotationStore } from './routine-rotation-store';

const PLAN: RoutineRotation = {
  startsOn: '2026-11-02',
  steps: [
    { routineId: 'normal', weeks: 2 },
    { routineId: 'light', weeks: 1 },
  ],
};

/** Keeps what the store reported, so a test can check a failure reached the screen. */
class RecordingErrorHandler extends ErrorHandler {
  readonly errors: unknown[] = [];

  override handleError(error: unknown): void {
    this.errors.push(error);
  }
}

/** Answers saves only when the test says so, to look at the store while one is in flight. */
class PendingSaveGateway extends FakeRoutineRotationGateway {
  readonly answers = new Subject<RoutineRotation>();

  override save(): Observable<RoutineRotation> {
    return this.answers;
  }
}

function createStore(gateway = new FakeRoutineRotationGateway(PLAN)): {
  store: RoutineRotationStore;
  errors: RecordingErrorHandler;
} {
  const errors = new RecordingErrorHandler();
  TestBed.configureTestingModule({
    providers: [
      { provide: RoutineRotationGateway, useValue: gateway },
      { provide: ErrorHandler, useValue: errors },
    ],
  });
  return { store: TestBed.inject(RoutineRotationStore), errors };
}

describe('RoutineRotationStore', () => {
  it('loads the stored rotation', () => {
    const { store } = createStore();

    expect([store.rotation(), store.isLoaded()]).toEqual([PLAN, true]);
  });

  it('shows a save right away and keeps the version the gateway answered with', async () => {
    const gateway = new PendingSaveGateway(PLAN);
    const { store } = createStore(gateway);
    const edited: RoutineRotation = { ...PLAN, startsOn: '2026-11-11' };
    const stored: RoutineRotation = { ...PLAN, startsOn: '2026-11-09' };

    const saving = store.save(edited);
    const shownWhileSaving = store.rotation();
    gateway.answers.next(stored);

    expect([shownWhileSaving, await saving, store.rotation()]).toEqual([edited, true, stored]);
  });

  it('puts the previous rotation back and reports it when the save is rejected', async () => {
    const gateway = new FakeRoutineRotationGateway(PLAN);
    const { store, errors } = createStore(gateway);
    gateway.failure = new Error('Expected an existing routine with id "gone", found none');

    const isSaved = await store.save({ ...PLAN, steps: [{ routineId: 'gone', weeks: 1 }] });

    expect([isSaved, store.rotation(), errors.errors]).toEqual([false, PLAN, [gateway.failure]]);
  });

  it("lets go of a deleted routine's steps", () => {
    const { store } = createStore();

    store.forgetRoutine('normal');

    expect(store.rotation().steps).toEqual([{ routineId: 'light', weeks: 1 }]);
  });

  it('flags a failed load and loads again on reload', () => {
    const gateway = new FakeRoutineRotationGateway(PLAN);
    gateway.failure = new Error('offline');
    const { store } = createStore(gateway);
    const failedFirst = store.hasLoadFailed();
    gateway.failure = undefined;

    store.reload();

    expect([failedFirst, store.hasLoadFailed(), store.rotation()]).toEqual([true, false, PLAN]);
  });

  it('starts with the rotation off', () => {
    expect(createStore(new FakeRoutineRotationGateway()).store.rotation()).toBe(NO_ROTATION);
  });
});
