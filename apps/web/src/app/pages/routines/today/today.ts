import { Component, LOCALE_ID, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeading } from '../../../components/page-heading/page-heading';
import { Clock } from '../../../core/calendar/clock';
import { longDateLabel } from '../../../core/calendar/date-label';
import { minutesOfDay, weekdayIndex } from '../../../core/calendar/time-of-day';
import { Category, findCategory } from '../../../core/routines/category';
import { dayProgress } from '../../../core/routines/day-timeline';
import { GOAL_TYPE_LABELS, Goal, goalPeriodInfo, goalProgress } from '../../../core/routines/goal';
import { routineForWeekday } from '../../../core/routines/routine';
import { RoutinesStore } from '../../../core/routines/routines-store';
import { Task } from '../../../core/routines/task';
import { DayTimeline } from './day-timeline/day-timeline';
import { NowCard } from './now-card/now-card';

/** Goals shown in the "Goals in focus" card. */
const FOCUS_GOAL_COUNT = 3;

interface TaskView {
  readonly task: Task;
  readonly category?: Category;
}

interface FocusGoalView {
  readonly goal: Goal;
  readonly meta: string;
  readonly value: string;
  readonly percent: number;
  readonly color: string;
}

/** Module landing page: today's timeline, the block happening now, tasks and goals in focus. */
@Component({
  selector: 'app-routines-today',
  imports: [RouterLink, PageHeading, DayTimeline, NowCard],
  templateUrl: './today.html',
  styleUrl: './today.css',
})
export class Today {
  private readonly store = inject(RoutinesStore);
  private readonly now = inject(Clock).now();

  protected readonly nowMinutes = minutesOfDay(this.now);
  protected readonly dateLabel = longDateLabel(this.now, inject(LOCALE_ID));
  protected readonly categories = this.store.categories;
  protected readonly routine = computed(() =>
    routineForWeekday(this.store.routines(), weekdayIndex(this.now)),
  );
  protected readonly dayPercent = computed(() => {
    const routine = this.routine();
    return routine === undefined ? 0 : dayProgress(routine, this.nowMinutes);
  });
  protected readonly tasks = computed(() =>
    this.store.tasks().map((task): TaskView => ({ task, category: this.categoryOf(task) })),
  );
  protected readonly doneCount = computed(
    () => this.store.tasks().filter((task) => task.done).length,
  );
  protected readonly focusGoals = computed(() =>
    this.store
      .goals()
      .filter((goal) => goal.done < goal.target)
      .slice(0, FOCUS_GOAL_COUNT)
      .map((goal) => this.toFocusGoal(goal)),
  );

  protected toggleTask(taskId: string): void {
    this.store.toggleTask(taskId);
  }

  private categoryOf(item: { readonly categoryId?: string }): Category | undefined {
    return findCategory(this.store.categories(), item.categoryId);
  }

  private toFocusGoal(goal: Goal): FocusGoalView {
    const category = this.categoryOf(goal);
    const unit = goal.type === 'objective' && goal.unit ? ` ${goal.unit}` : '';
    return {
      goal,
      meta: [GOAL_TYPE_LABELS[goal.type], goalPeriodInfo(goal.period).label, category?.name]
        .filter((part) => part !== undefined)
        .join(' · '),
      value: `${goal.done}/${goal.target}${unit}`,
      percent: goalProgress(goal),
      color: category?.color ?? 'var(--color-mint)',
    };
  }
}
