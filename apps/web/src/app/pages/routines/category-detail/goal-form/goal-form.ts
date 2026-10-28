import { Component, OnInit, computed, input, output, signal } from '@angular/core';
import { formatDate } from '@angular/common';
import { withAlpha } from '../../../../core/routines/category';
import {
  GOAL_PERIODS,
  GOAL_TRACKING_OPTIONS,
  GOAL_TYPE_LABELS,
  Goal,
  GoalChanges,
  GoalPeriod,
  GoalTracking,
  GoalType,
  goalPeriodInfo,
  parseIsoDate,
  periodFooter,
  shortDate,
  usesDots,
} from '../../../../core/routines/goal';
import { GoalDraft } from '../../../../core/routines/routines-store';

const ISO_DATE_FORMAT = 'yyyy-MM-dd';
const DEFAULT_CUSTOM_PERIOD_DAYS = 50;
const MAX_PREVIEW_DOTS = 10;

const GOAL_TYPE_OPTIONS: readonly {
  readonly value: GoalType;
  readonly label: string;
  readonly description: string;
}[] = [
  {
    value: 'frequency',
    label: 'By frequency',
    description: 'Repeat an action X times in the period.',
  },
  { value: 'objective', label: 'By objective', description: 'Reach a value or milestone.' },
];

/** Inline form to define a goal for a category, with a live preview of the resulting card. */
@Component({
  selector: 'app-goal-form',
  templateUrl: './goal-form.html',
  styleUrl: './goal-form.css',
})
export class GoalForm implements OnInit {
  readonly categoryId = input.required<string>();
  readonly color = input.required<string>();
  readonly today = input.required<Date>();
  /** The goal being edited; leave unset to set a new one. */
  readonly goal = input<Goal | undefined>(undefined);
  readonly create = output<GoalDraft>();
  readonly save = output<GoalChanges>();
  readonly dismiss = output();

  protected readonly typeOptions = GOAL_TYPE_OPTIONS;
  protected readonly periods = GOAL_PERIODS;
  protected readonly name = signal('');
  protected readonly type = signal<GoalType>('frequency');
  protected readonly period = signal<GoalPeriod>('weekly');
  protected readonly times = signal(3);
  protected readonly target = signal(10);
  protected readonly unit = signal('');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly tracking = signal<GoalTracking>('manual');
  protected readonly trackingOptions = GOAL_TRACKING_OPTIONS;
  protected readonly isEditing = computed(() => this.goal() !== undefined);
  protected readonly trackingHint = computed(
    () => GOAL_TRACKING_OPTIONS.find((option) => option.value === this.tracking())?.hint ?? '',
  );

  protected readonly ring = computed(() => withAlpha(this.color(), 0.4));
  protected readonly selectedTint = computed(() => withAlpha(this.color(), 0.08));
  protected readonly selectedBorder = computed(() => withAlpha(this.color(), 0.5));
  protected readonly cadence = computed(
    () => `${this.times() === 1 ? 'time' : 'times'} ${goalPeriodInfo(this.period()).cadence}`,
  );
  protected readonly previewTag = computed(
    () => `${GOAL_TYPE_LABELS[this.type()]} · ${goalPeriodInfo(this.period()).label}`,
  );
  protected readonly previewUsesDots = computed(() =>
    usesDots({ type: this.type(), target: this.times() }),
  );
  protected readonly previewDots = computed(() =>
    Array.from({ length: Math.min(this.times(), MAX_PREVIEW_DOTS) }, (_, index) => index),
  );
  protected readonly previewValue = computed(() =>
    this.type() === 'frequency'
      ? `0 of ${this.times()} ${this.times() === 1 ? 'time' : 'times'}`
      : `0 of ${this.target()} ${this.unit()}`.trim(),
  );
  protected readonly previewFooter = computed(() => {
    if (this.period() !== 'custom') return periodFooter(this.period(), this.today());
    return `${shortDate(parseIsoDate(this.customFrom()))} – ${shortDate(parseIsoDate(this.customTo()))}`;
  });

  protected readonly customFrom = computed(() => this.from() || this.isoDate(0));
  protected readonly customTo = computed(
    () => this.to() || this.isoDate(DEFAULT_CUSTOM_PERIOD_DAYS),
  );

  /** Fills the fields from the goal being edited; a new goal keeps the defaults. */
  ngOnInit(): void {
    const goal = this.goal();
    if (goal === undefined) return;
    this.name.set(goal.title);
    this.type.set(goal.type);
    this.period.set(goal.period);
    this.tracking.set(goal.tracking);
    if (goal.type === 'frequency') this.times.set(goal.target);
    else this.target.set(goal.target);
    this.unit.set(goal.unit ?? '');
    this.to.set(goal.deadline ?? '');
  }

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    const title = this.name().trim();
    if (title === '') return;
    const draft = this.toDraft(title);
    if (!this.isEditing()) {
      this.create.emit(draft);
      return;
    }
    this.save.emit({
      title: draft.title,
      period: draft.period,
      target: draft.target,
      unit: draft.unit,
      deadline: draft.deadline,
      tracking: draft.tracking,
    });
  }

  protected textOf(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  /** Number fields never go below one, matching their `min` attribute. */
  protected countOf(event: Event): number {
    return Math.max(1, Number.parseInt(this.textOf(event), 10) || 1);
  }

  private toDraft(title: string): GoalDraft {
    const isFrequency = this.type() === 'frequency';
    return {
      categoryId: this.categoryId(),
      title,
      type: this.type(),
      period: this.period(),
      target: isFrequency ? this.times() : this.target(),
      unit: isFrequency ? undefined : this.unit().trim() || undefined,
      deadline: this.period() === 'custom' ? this.customTo() : undefined,
      tracking: isFrequency ? this.tracking() : 'manual',
    };
  }

  private isoDate(daysFromToday: number): string {
    const today = this.today();
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysFromToday);
    return formatDate(date, ISO_DATE_FORMAT, 'en-US');
  }
}
