import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatDuration } from '../../../../core/calendar/time-of-day';
import { Category } from '../../../../core/routines/category';
import {
  Routine,
  plannedMinutes,
  routineSpan,
  weeklyMinutesByCategory,
} from '../../../../core/routines/routine';

interface CategoryHoursView {
  readonly category: Category;
  readonly hours: string;
  readonly percent: number;
}

/** Side card with planned vs free time and the weekly hours each category gets. */
@Component({
  selector: 'app-routine-summary',
  imports: [RouterLink],
  templateUrl: './routine-summary.html',
  styleUrl: './routine-summary.css',
})
export class RoutineSummary {
  readonly routine = input.required<Routine>();
  readonly categories = input.required<readonly Category[]>();

  protected readonly planned = computed(() => formatDuration(plannedMinutes(this.routine())));
  protected readonly free = computed(() =>
    formatDuration(Math.max(0, routineSpan(this.routine()) - plannedMinutes(this.routine()))),
  );
  protected readonly categoryHours = computed(() => {
    const totals = weeklyMinutesByCategory(this.routine());
    const longest = Math.max(1, ...totals.values());
    return this.categories()
      .filter((category) => totals.has(category.id))
      .map((category): CategoryHoursView => {
        const minutes = totals.get(category.id) ?? 0;
        return { category, hours: formatDuration(minutes), percent: (minutes / longest) * 100 };
      });
  });
}
