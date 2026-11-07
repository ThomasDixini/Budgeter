import { ActivatedRouteSnapshot, ViewTransitionInfo } from '@angular/router';
import { moduleMove } from './module-transition';

const MOVE_ATTRIBUTE = 'moduleMove';

function moduleSegmentOf(snapshot: ActivatedRouteSnapshot): string {
  // The router hands over the root snapshot; its first child is the module's route.
  return snapshot.firstChild?.url[0]?.path ?? '';
}

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * Lets the browser slide the page only when the person changes module, and stay still for any other
 * navigation or for someone who asked for less motion. The direction is left on the page element for the
 * styles to read, and taken off once the transition ends.
 * @example provideRouter(routes, withViewTransitions({ onViewTransitionCreated: animateModuleSwitch }))
 */
export function animateModuleSwitch(info: ViewTransitionInfo): void {
  // Skipping a transition (here, or by the next navigation) rejects `ready` with an AbortError that nobody
  // else listens to; it only means the move did not run, so it is not reported as an error.
  info.transition.ready.catch(() => undefined);
  const move = moduleMove(moduleSegmentOf(info.from), moduleSegmentOf(info.to));
  if (move === undefined || prefersReducedMotion()) {
    info.transition.skipTransition();
    return;
  }
  const page = document.documentElement;
  page.dataset[MOVE_ATTRIBUTE] = move;
  const clear = (): void => {
    delete page.dataset[MOVE_ATTRIBUTE];
  };
  info.transition.finished.then(clear, clear);
}
