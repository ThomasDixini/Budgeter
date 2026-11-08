import { ActivatedRouteSnapshot, ViewTransitionInfo } from '@angular/router';
import { animateModuleSwitch } from './module-view-transition';

/** A route snapshot whose first child is the route of one module (an empty segment is the home page). */
function snapshotOf(segment: string): ActivatedRouteSnapshot {
  const url = segment === '' ? [] : [{ path: segment }];
  return { firstChild: { url } } as unknown as ActivatedRouteSnapshot;
}

/** The pieces of a view transition the function touches; `finish` ends it. */
class FakeViewTransition {
  skipped = false;
  finish: () => void = () => undefined;
  readonly finished = new Promise<void>((resolve) => (this.finish = resolve));
  /** Handlers given to `ready.catch`; the browser rejects `ready` with an AbortError once a transition is skipped. */
  readonly readyHandlers: ((reason: unknown) => unknown)[] = [];
  readonly ready = {
    catch: (handler: (reason: unknown) => unknown): void => {
      this.readyHandlers.push(handler);
    },
  };

  skipTransition(): void {
    this.skipped = true;
  }
}

function moveBetween(from: string, to: string): { transition: FakeViewTransition } {
  const transition = new FakeViewTransition();
  animateModuleSwitch({
    transition,
    from: snapshotOf(from),
    to: snapshotOf(to),
  } as unknown as ViewTransitionInfo);
  return { transition };
}

function preferReducedMotion(reduced: boolean): void {
  vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
}

describe('animateModuleSwitch', () => {
  it('catches the AbortError a skipped transition raises, so it is not reported', () => {
    preferReducedMotion(false);

    const { transition } = moveBetween('', 'routines');

    expect(transition.readyHandlers).toHaveLength(1);
    expect(
      transition.readyHandlers[0](new DOMException('Transition was skipped', 'AbortError')),
    ).toBeUndefined();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete document.documentElement.dataset['moduleMove'];
  });

  it('leaves the direction on the page while the move runs and takes it off at the end', async () => {
    preferReducedMotion(false);

    const { transition } = moveBetween('', 'routines');
    const during = document.documentElement.dataset['moduleMove'];
    transition.finish();
    await transition.finished;
    await Promise.resolve();

    expect([during, document.documentElement.dataset['moduleMove'], transition.skipped]).toEqual([
      'forward',
      undefined,
      false,
    ]);
  });

  it('points backward when going back along the modules', () => {
    preferReducedMotion(false);

    moveBetween('finances', 'routines');

    expect(document.documentElement.dataset['moduleMove']).toBe('backward');
  });

  it('skips the transition inside the same module', () => {
    preferReducedMotion(false);

    const { transition } = moveBetween('finances', 'finances');

    expect([transition.skipped, document.documentElement.dataset['moduleMove']]).toEqual([
      true,
      undefined,
    ]);
  });

  it('skips the transition for someone who prefers reduced motion', () => {
    preferReducedMotion(true);

    const { transition } = moveBetween('', 'finances');

    expect([transition.skipped, document.documentElement.dataset['moduleMove']]).toEqual([
      true,
      undefined,
    ]);
  });
});
