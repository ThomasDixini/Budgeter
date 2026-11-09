import { ErrorHandler, Injectable, inject, signal } from '@angular/core';
import { NO_ROTATION, RoutineRotation } from './routine-rotation';
import { RoutineRotationGateway } from './routine-rotation-gateway';
import { withoutRoutine } from './rotation-edits';

/**
 * The routine rotation, loaded from and saved through its gateway. A save shows right away and goes
 * back if the gateway rejects it, unless a newer save replaced it meanwhile.
 */
@Injectable({ providedIn: 'root' })
export class RoutineRotationStore {
  private readonly gateway = inject(RoutineRotationGateway);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly current = signal<RoutineRotation>(NO_ROTATION);
  private readonly loaded = signal(false);
  private readonly loadFailed = signal(false);

  readonly rotation = this.current.asReadonly();
  readonly isLoaded = this.loaded.asReadonly();
  readonly hasLoadFailed = this.loadFailed.asReadonly();

  constructor() {
    this.load();
  }

  /**
   * Loads the rotation again after a failed load.
   * @example store.reload()
   */
  reload(): void {
    if (this.loaded()) return;
    this.loadFailed.set(false);
    this.load();
  }

  /**
   * Saves the rotation as a whole. Resolves to whether the gateway accepted it.
   * @example const saved = await store.save({ startsOn: '2026-11-02', steps: [{ routineId: 'normal', weeks: 2 }] })
   */
  save(rotation: RoutineRotation): Promise<boolean> {
    const previous = this.current();
    this.current.set(rotation);
    return new Promise((resolve) => {
      this.gateway.save(rotation).subscribe({
        next: (saved) => {
          this.replaceIfShown(rotation, saved);
          resolve(true);
        },
        error: (error: unknown) => {
          this.replaceIfShown(rotation, previous);
          this.errorHandler.handleError(error);
          resolve(false);
        },
      });
    });
  }

  /**
   * Lets go of a deleted routine's steps, which the API dropped along with the routine.
   * @example store.forgetRoutine('light')
   */
  forgetRoutine(routineId: string): void {
    this.current.update((rotation) => withoutRoutine(rotation, routineId));
  }

  private load(): void {
    this.gateway.get().subscribe({
      next: (rotation) => {
        this.current.set(rotation);
        this.loaded.set(true);
      },
      error: (error: unknown) => {
        this.loadFailed.set(true);
        this.errorHandler.handleError(error);
      },
    });
  }

  private replaceIfShown(shown: RoutineRotation, next: RoutineRotation): void {
    if (this.current() === shown) this.current.set(next);
  }
}
