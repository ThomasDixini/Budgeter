import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  LOCALE_ID,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeading } from '../../../components/page-heading/page-heading';
import { Clock } from '../../../core/calendar/clock';
import { isoDate, longDateLabel } from '../../../core/calendar/date-label';
import { minutesOfDay, toMinutes, weekdayIndex } from '../../../core/calendar/time-of-day';
import { Category, findCategory } from '../../../core/routines/category';
import { isHappening } from '../../../core/routines/day-clock';
import { dayProgress } from '../../../core/routines/day-timeline';
import {
  GOAL_TYPE_LABELS,
  Goal,
  goalPeriodInfo,
  goalProgress,
  goalValueLabel,
  isGoalMet,
} from '../../../core/routines/goal';
import { activeRoutine } from '../../../core/routines/routine';
import { RoutinesStore } from '../../../core/routines/routines-store';
import { NotTodayGroup, Task, TaskDraft, occursOn, repeatLabel } from '../../../core/routines/task';
import { TasksStore } from '../../../core/routines/tasks-store';
import { BlockOutcomesStore } from '../../../core/routines/block-outcomes-store';
import { BlockOutcomeKind, planDay } from '../../../core/routines/day-plan';
import { DayTimeline } from './day-timeline/day-timeline';
import { EndedBlock, NowCard } from './now-card/now-card';
import { TaskForm } from './task-form/task-form';

/** How often the "now" line and the Now card catch up with the clock. */
const CLOCK_TICK_MS = 30_000;

/** Goals shown in the "Goals in focus" card. */
const FOCUS_GOAL_COUNT = 3;

interface NotTodayView {
  readonly task: Task;
  readonly group: NotTodayGroup;
  readonly category?: Category;
  /** How often it repeats, or its day when it is a one-time task, e.g. "Oct 30". */
  readonly repeat: string;
}

const NOT_TODAY_GROUP_LABELS: Readonly<Record<NotTodayGroup, string>> = {
  scheduled: 'Scheduled',
  repeating: 'Other days',
  past: 'Past',
};

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
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** The button the open task form came from, so the focus can go back to it. */
  private opener: HTMLElement | undefined;
  private readonly outcomesStore = inject(BlockOutcomesStore);
  private readonly clock = inject(Clock);
  /** The day the task lists are about, fixed when the page opens (see `TasksStore`). */
  private readonly now = this.clock.now();
  private readonly locale = inject(LOCALE_ID);
  private readonly moment = signal(this.now);

  /** Ticks with the clock, so the timeline and the Now card move on without a reload. */
  protected readonly nowMinutes = computed(() => minutesOfDay(this.moment()));
  protected readonly dateLabel = computed(() => longDateLabel(this.moment(), this.locale));
  protected readonly categories = this.store.categories;
  /** The routine running now, which may be last night's when it runs past midnight. */
  private readonly active = computed(() =>
    activeRoutine(this.store.routines(), weekdayIndex(this.moment()), this.nowMinutes()),
  );
  /** The running routine's version of the day, with completed and skipped blocks applied. */
  protected readonly plan = computed(() => {
    const routine = this.active()?.routine;
    return routine === undefined ? undefined : planDay(routine, this.outcomesStore.outcomes());
  });
  protected readonly routine = computed(() => this.plan()?.routine);
  protected readonly outcomes = computed(
    () => this.plan()?.outcomes ?? new Map<string, BlockOutcomeKind>(),
  );
  protected readonly plannedLengths = computed(
    () => this.plan()?.plannedLengths ?? new Map<string, number>(),
  );
  /** The block ended most recently today, offered for a quick undo on the Now card. */
  protected readonly lastEnded = computed((): EndedBlock | undefined => {
    const routine = this.routine();
    const last = this.outcomesStore
      .outcomes()
      .filter((outcome) => outcome.routineId === routine?.id)
      .at(-1);
    const block = routine?.blocks.find((candidate) => candidate.id === last?.blockId);
    return last && block
      ? { blockId: block.id, name: block.name, outcome: last.outcome }
      : undefined;
  });
  protected readonly dayPercent = computed(() => {
    const routine = this.routine();
    return routine === undefined ? 0 : dayProgress(routine, this.nowMinutes());
  });
  protected readonly weekday = weekdayIndex(this.now);
  protected readonly isAddingTask = signal(false);
  protected readonly todayIso = isoDate(this.now);
  /** Id of the task whose form is open for editing. */
  protected readonly editingTaskId = signal<string | undefined>(undefined);
  /** The task being edited as a list of at most one: tracked by id, so another task's form is rebuilt. */
  protected readonly editingTasks = computed(() =>
    this.tasksStore.tasks().filter((task) => task.id === this.editingTaskId()),
  );
  protected readonly isNotTodayOpen = signal(false);
  /** The task just added or edited out of today's list, so it can be found in "Not today". */
  protected readonly highlightedTaskId = signal<string | undefined>(undefined);
  protected readonly notTodayGroupLabels = NOT_TODAY_GROUP_LABELS;
  protected readonly notToday = computed(() =>
    this.tasksStore.notToday().map(({ task, group }): NotTodayView => ({
      task,
      group,
      category: this.categoryOf(task),
      repeat: repeatLabel(task, this.todayIso),
    })),
  );
  /** The block picked on the timeline to filter today's tasks by; none shows every task. */
  protected readonly selectedBlockId = signal<string | undefined>(undefined);
  protected readonly selectedBlock = computed(() =>
    this.routine()?.blocks.find((block) => block.id === this.selectedBlockId()),
  );
  protected readonly tasks = computed(() =>
    this.tasksStore
      .todayTasks()
      .filter(({ task }) => this.isRelatedToSelectedBlock(task))
      .map(({ task, isDone }): TaskView => ({
        task,
        isDone,
        category: this.categoryOf(task),
        repeat: repeatLabel(task, this.todayIso),
      })),
  );
  protected readonly doneCount = computed(() => this.tasks().filter((item) => item.isDone).length);
  protected readonly focusGoals = computed(() =>
    this.store
      .goals()
      .filter((goal) => !isGoalMet(goal))
      .slice(0, FOCUS_GOAL_COUNT)
      .map((goal) => this.toFocusGoal(goal)),
  );

  constructor() {
    const timer = setInterval(() => this.moment.set(this.clock.now()), CLOCK_TICK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
    effect(() => this.outcomesStore.showDay(this.routineDay()));
  }

  /** The day the running routine began on: yesterday for a night shift still going. */
  private routineDay(): string {
    const started = new Date(this.moment());
    if (this.active()?.startedYesterday) started.setDate(started.getDate() - 1);
    return isoDate(started);
  }

  /**
   * Ends a block as done or skipped. The running block ends now and the rest of the day moves earlier;
   * one that is ahead or already over ends at its planned end, so nothing else moves.
   * @example this.endBlock('project', 'done')
   */
  protected endBlock(blockId: string, kind: BlockOutcomeKind): void {
    const routine = this.routine();
    const block = routine?.blocks.find((candidate) => candidate.id === blockId);
    if (routine === undefined || block === undefined) return;
    const now = minutesOfDay(this.clock.now());
    this.moment.set(this.clock.now());
    const at = isHappening(block, now) ? now : toMinutes(block.end);
    this.outcomesStore.record(routine.id, blockId, kind, at);
  }

  /**
   * Takes back a block completed or skipped by mistake; it and the blocks after it return to plan.
   * @example this.undoBlock('project')
   */
  protected undoBlock(blockId: string): void {
    const routine = this.routine();
    if (routine !== undefined) this.outcomesStore.undo(routine.id, blockId);
  }

  /** Picks a block to filter the tasks by; clicking the picked one again shows every task. */
  protected toggleBlockSelection(blockId: string): void {
    this.selectedBlockId.set(this.selectedBlockId() === blockId ? undefined : blockId);
  }

  /** Tasks relate to a block through the category they share; with no block picked all of them do. */
  private isRelatedToSelectedBlock(task: Task): boolean {
    const block = this.selectedBlock();
    return block === undefined || task.categoryId === block.categoryId;
  }

  protected toggleTask(taskId: string): void {
    this.tasksStore.toggleDone(taskId);
  }

  protected startAddingTask(trigger: Event): void {
    this.editingTaskId.set(undefined);
    this.opener = trigger.currentTarget as HTMLElement;
    this.isAddingTask.set(!this.isAddingTask());
  }

  protected startEditingTask(taskId: string, trigger: Event): void {
    this.isAddingTask.set(false);
    this.opener = trigger.currentTarget as HTMLElement;
    this.editingTaskId.set(taskId);
  }

  protected closeTaskForm(): void {
    this.isAddingTask.set(false);
    this.editingTaskId.set(undefined);
    this.restoreFocus();
  }

  protected addTask(draft: TaskDraft): void {
    const task = this.tasksStore.addTask(draft);
    this.closeTaskForm();
    this.revealIfNotToday(task);
  }

  protected saveTask(taskId: string, draft: TaskDraft): void {
    const task = this.tasksStore.updateTask(taskId, draft);
    this.closeTaskForm();
    if (task !== undefined) this.revealIfNotToday(task);
  }

  /**
   * Puts the focus back where the form was opened from. If that button is gone (the task moved to
   * "Not today"), it goes to the "Not today" toggle, or the + button, so it never falls to the page.
   */
  private restoreFocus(): void {
    afterNextRender(
      () => {
        const host = this.host.nativeElement;
        const fallback =
          host.querySelector<HTMLElement>('.not-today-toggle') ??
          host.querySelector<HTMLElement>('[aria-label="New task"]');
        (this.opener?.isConnected ? this.opener : fallback)?.focus();
      },
      { injector: this.injector },
    );
  }

  /**
   * A task saved for another day leaves today's list at once, which would look like it was lost:
   * open "Not today" and mark it so it is easy to find.
   */
  private revealIfNotToday(task: Task): void {
    const isToday = occursOn(task, this.now, this.todayIso);
    this.highlightedTaskId.set(isToday ? undefined : task.id);
    if (!isToday) this.isNotTodayOpen.set(true);
  }

  protected deleteTask(taskId: string): void {
    if (this.editingTaskId() === taskId) this.editingTaskId.set(undefined);
    this.tasksStore.deleteTask(taskId);
  }

  private categoryOf(item: { readonly categoryId?: string }): Category | undefined {
    return findCategory(this.store.categories(), item.categoryId);
  }

  private toFocusGoal(goal: Goal): FocusGoalView {
    const category = this.categoryOf(goal);
    return {
      goal,
      meta: [GOAL_TYPE_LABELS[goal.type], goalPeriodInfo(goal.period).label, category?.name]
        .filter((part) => part !== undefined)
        .join(' · '),
      // Objectives in focus are never achieved, so they read "Not achieved yet".
      value: goal.type === 'objective' ? goalValueLabel(goal) : `${goal.done}/${goal.target}`,
      percent: goalProgress(goal),
      color: category?.color ?? 'var(--color-mint)',
    };
  }
}
