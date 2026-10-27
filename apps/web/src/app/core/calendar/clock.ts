import { Injectable } from '@angular/core';

/** Source of the current time; injected so date-dependent screens stay testable. */
@Injectable({ providedIn: 'root' })
export class Clock {
  /**
   * Current date and time.
   * @example inject(Clock).now().getHours() // 9
   */
  now(): Date {
    return new Date();
  }
}
