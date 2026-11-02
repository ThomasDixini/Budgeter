import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { Clock } from '../../core/calendar/clock';
import { FixedClock } from '../../core/calendar/fixed-clock';
import { provideFakeRoutinesGateways } from '../../core/routines/fake-routines-gateways';
import { RoutinesStore } from '../../core/routines/routines-store';

/** Monday 26 Oct 2026, 14:10: during the "C# study" block of the weekday routine. */
export const STUDY_TIME = new Date(2026, 9, 26, 14, 10);

/**
 * Opens a page of the module through the real routes, on fake gateways and a fixed clock.
 * @example const element = await openPage('/routines', new Date(2026, 9, 26, 7, 30));
 */
export async function openPage(
  url: string,
  now = STUDY_TIME,
  prepare: (store: RoutinesStore) => void = () => undefined,
): Promise<HTMLElement> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      { provide: Clock, useValue: new FixedClock(now) },
      ...provideFakeRoutinesGateways(),
    ],
  });
  prepare(TestBed.inject(RoutinesStore));
  const harness = await RouterTestingHarness.create(url);
  harness.detectChanges();
  return harness.routeNativeElement as HTMLElement;
}

/** Clicks the button with this text, failing the test when there is none. */
export function clickButton(element: HTMLElement, label: string): void {
  const buttons = [...element.querySelectorAll<HTMLButtonElement>('button')];
  const button = buttons.find((candidate) => candidate.textContent?.trim() === label);
  if (button === undefined) throw new Error(`Expected a button labelled "${label}", found none`);
  button.click();
  TestBed.tick();
}

/** The trimmed text of the first element matching the selector. */
export function text(element: HTMLElement, selector: string): string | undefined {
  return element.querySelector(selector)?.textContent?.trim();
}
