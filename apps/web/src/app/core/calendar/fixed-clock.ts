import { Clock } from './clock';

/** Test double that always reports the same moment. */
export class FixedClock extends Clock {
  constructor(private readonly fixedMoment: Date) {
    super();
  }

  override now(): Date {
    return new Date(this.fixedMoment);
  }
}
