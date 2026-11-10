import { Component } from '@angular/core';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

/** Landing section that shows the Routines & Goals module next to an illustrative preview of its Today screen. */
@Component({
  selector: 'app-routines-showcase',
  imports: [TranslatePipe],
  templateUrl: './routines-showcase.html',
  styleUrl: './routines-showcase.css',
})
export class RoutinesShowcase {
  protected readonly points: readonly string[] = [
    'Several routines, like weekdays and weekends, with a warning when blocks overlap',
    'Goals by frequency (5 times a week) or by target (12 modules of a course)',
    'Daily, weekly, monthly, yearly or with dates you set',
    'A “Today” panel with the day timeline, the current block and the tasks',
  ];
}
