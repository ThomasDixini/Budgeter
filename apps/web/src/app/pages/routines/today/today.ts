import { Component, LOCALE_ID, computed, inject, signal } from '@angular/core';
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
import { Task, TaskDraft, repeatLabel } from '../../../core/routines/task';
import { TasksStore } from '../../../core/routines/tasks-store';
import { DayTimeline } from './day-timeline/day-timeline';
import { NowCard } from './now-card/now-card';
import { TaskForm } from './task-form/task-form';

/** Goals shown in the "Goals in focus" card. */
const FOCUS_GOAL_COUNT = 3;

interface TaskView {
  readonly task: Task;
  readonly isDone: boolean;
  readonly category?: Category;
  /** How often it repeats, e.g. "Every day". */
  readonly repeat: string;
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
  imports: [RouterLink, PageHeading, DayTimeline, NowCard, TaskForm],
  templateUrl: './today.html',
  styleUrl: './today.css',
})
export class Today {
  private readonly store = inject(RoutinesStore);
  private readonly tasksStore = inject(TasksStore);
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
  protected readonly weekday = weekdayIndex(this.now);
  protected readonly isAddingTask = signal(false);
  protected readonly tasks = computed(() =>
    this.tasksStore.todayTasks().map(({ task, isDone }): TaskView => ({
      task,
      isDone,
      category: this.categoryOf(task),
      repeat: repeatLabel(task),
    })),
  );
  protected readonly doneCount = computed(() => this.tasks().filter((item) => item.isDone).length);
  protected readonly focusGoals = computed(() =>
    this.store
      .goals()
      .filter((goal) => goal.done < goal.target)
      .slice(0, FOCUS_GOAL_COUNT)
      .map((goal) => this.toFocusGoal(goal)),
  );

  protected toggleTask(taskId: string): void {
    this.tasksStore.toggleDone(taskId);
  }

  protected addTask(draft: TaskDraft): void {
    this.tasksStore.addTask(draft);
    this.isAddingTask.set(false);
  }

  protected deleteTask(taskId: string): void {
    this.tasksStore.deleteTask(taskId);
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
