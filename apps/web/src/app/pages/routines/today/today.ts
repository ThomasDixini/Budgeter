import { Component, DestroyRef, LOCALE_ID, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeading } from '../../../components/page-heading/page-heading';
import { Clock } from '../../../core/calendar/clock';
import { isoDate, longDateLabel } from '../../../core/calendar/date-label';
import { minutesOfDay, toMinutes, weekdayIndex } from '../../../core/calendar/time-of-day';
import { isHappening } from '../../../core/routines/day-clock';
import { dayProgress } from '../../../core/routines/day-timeline';
import { activeRoutine } from '../../../core/routines/routine';
import { RoutinesStore } from '../../../core/routines/routines-store';
import { TasksStore } from '../../../core/routines/tasks-store';
import { BlockOutcomesStore } from '../../../core/routines/block-outcomes-store';
import { BlockOutcomeKind, planDay } from '../../../core/routines/day-plan';
import { DayTimeline } from './day-timeline/day-timeline';
import { EndedBlock, NowCard } from './now-card/now-card';
import { TodayGoals } from './today-goals/today-goals';
import { TodayTasks } from './today-tasks/today-tasks';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

/** How often the "now" line and the Now card catch up with the clock. */
const CLOCK_TICK_MS = 30_000;

/** Module landing page: today's timeline, the block happening now, tasks and goals in focus. */
@Component({
  selector: 'app-routines-today',
  imports: [TranslatePipe, RouterLink, PageHeading, DayTimeline, NowCard, TodayGoals, TodayTasks],
  templateUrl: './today.html',
  styleUrl: './today.css',
})
export class Today {
  private readonly store = inject(RoutinesStore);
  private readonly tasksStore = inject(TasksStore);
  private readonly outcomesStore = inject(BlockOutcomesStore);
  private readonly clock = inject(Clock);
  private readonly locale = inject(LOCALE_ID);
  /** The current moment; it moves on with the clock and decides what is running and what is due. */
  protected readonly moment = signal(this.clock.now());

  /** Ticks with the clock, so the timeline and the Now card move on without a reload. */
  protected readonly nowMinutes = computed(() => minutesOfDay(this.moment()));
  protected readonly dateLabel = computed(() => longDateLabel(this.moment(), this.locale));
  protected readonly categories = this.store.categories;
  /** The block picked on the timeline to filter today's tasks by; none shows every task. */
  protected readonly selectedBlockId = signal<string | undefined>(undefined);
  protected readonly selectedBlock = computed(() =>
    this.routine()?.blocks.find((block) => block.id === this.selectedBlockId()),
  );
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

  constructor() {
    const timer = setInterval(() => this.tick(), CLOCK_TICK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
    effect(() => this.outcomesStore.showDay(this.routineDay()));
  }

  /** Catches up with the clock; past midnight the tasks and goals move on to the new day too. */
  private tick(): void {
    this.moment.set(this.clock.now());
    this.tasksStore.followClock();
    this.store.followClock();
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
}
