import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import { BlockOutcomesGateway } from './block-outcomes-gateway';
import { BlockOutcome } from './day-plan';
import { Goal } from './goal';
import { GoalsGateway } from './goals-gateway';

/** What was recorded on one day: how blocks ended and how far each goal's period had come. */
export interface DayRecord {
  readonly isoDay: string;
  readonly outcomes: readonly BlockOutcome[];
  /** Every goal with the progress of its period around the day. */
  readonly goals: readonly Goal[];
}

/** Reads past days for the History page; nothing here changes what was recorded. */
@Injectable({ providedIn: 'root' })
export class DayRecords {
  private readonly outcomes = inject(BlockOutcomesGateway);
  private readonly goals = inject(GoalsGateway);

  /**
   * The blocks and goal progress of a day, loaded together.
   * @example inject(DayRecords).load('2026-10-27').subscribe((record) => record.outcomes.length)
   */
  load(isoDay: string): Observable<DayRecord> {
    return forkJoin({ outcomes: this.outcomes.list(isoDay), goals: this.goals.list(isoDay) }).pipe(
      map(({ outcomes, goals }) => ({ isoDay, outcomes, goals })),
    );
  }
}
