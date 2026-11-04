import { Component, LOCALE_ID, computed, inject, signal } from '@angular/core';
import { BarChart } from '../../../components/bar-chart/bar-chart';
import { ChartSeries, LineChart } from '../../../components/line-chart/line-chart';
import { LoadFailed } from '../../../components/load-failed/load-failed';
import { PageHeading } from '../../../components/page-heading/page-heading';
import { shortDateLabel } from '../../../core/calendar/date-label';
import { formatBalance, formatMoney, formatSignedMoney } from '../../../core/finances/money';
import {
  INVESTMENT_KIND_OPTIONS,
  Investment,
  InvestmentDraft,
  InvestmentKind,
  Movement,
  MonthlyPoint,
  PortfolioLine,
  averagePriceCents,
  formatPercent,
  investmentKindLabel,
  quantityText,
} from '../../../core/finances/investments';
import {
  InvestmentFilters,
  PERIOD_OPTIONS,
  PeriodMonths,
  appliedByMonth,
  distribution,
  filterLines,
  incomeByMonth,
  lineValueCents,
  monthKeys,
} from '../../../core/finances/investments-analytics';
import { InvestmentsStore } from '../../../core/finances/investments-store';
import { IncomeFields, IncomeForm } from './income-form/income-form';
import { MovementImport, MovementImportResult } from './movement-import/movement-import';
import { InvestmentForm } from './investment-form/investment-form';
import { PortfolioDistribution } from './portfolio-distribution/portfolio-distribution';
import { TradeFields, TradeForm } from './trade-form/trade-form';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

/** The inline form open above the lists, if any. */
type Panel =
  | { readonly kind: 'closed' }
  | { readonly kind: 'new' }
  | { readonly kind: 'edit'; readonly investmentId: string }
  | { readonly kind: 'trade'; readonly investmentId: string }
  | { readonly kind: 'income'; readonly investmentId: string };

interface Stat {
  readonly label: string;
  readonly value: string;
  readonly note?: string;
}

const CLOSED: Panel = { kind: 'closed' };
const DEFAULT_FILTERS: InvestmentFilters = { months: 12 };

/**
 * Investments: the portfolio (what is held, what it cost, what it is worth) narrowed by kind, asset and
 * period, with charts, how it splits between kinds, the table of assets, and the purchases, sales and
 * proventos behind it. Prices are typed by hand; the CDI comes from the Central Bank through the API.
 * Charts that need month-end history stay empty until the API sends it.
 */
@Component({
  selector: 'app-finances-investments',
  imports: [
    TranslatePipe,
    PageHeading,
    LoadFailed,
    InvestmentForm,
    TradeForm,
    IncomeForm,
    LineChart,
    BarChart,
    PortfolioDistribution,
    MovementImport,
  ],
  providers: [InvestmentsStore],
  templateUrl: './investments.html',
  styleUrl: './investments.css',
})
export class Investments {
  private readonly store = inject(InvestmentsStore);
  private readonly locale = inject(LOCALE_ID);

  protected readonly today = this.store.today;
  protected readonly isLoaded = this.store.isLoaded;
  protected readonly isSaving = this.store.isSaving;
  protected readonly hasLoadFailed = this.store.hasLoadFailed;
  protected readonly movements = this.store.movements;
  protected readonly panel = signal<Panel>(CLOSED);
  protected readonly isImportOpen = signal(false);
  /** What the last import came to, shown until the person moves on. */
  protected readonly importResult = signal<MovementImportResult | undefined>(undefined);
  protected readonly filters = signal<InvestmentFilters>(DEFAULT_FILTERS);
  protected readonly kindOptions = INVESTMENT_KIND_OPTIONS;
  protected readonly periodOptions = PERIOD_OPTIONS;
  protected readonly lines = computed(() => this.store.portfolio()?.lines ?? []);
  protected readonly tableLines = computed(() => this.sortedTableLines());
  protected readonly selected = computed(() => filterLines(this.lines(), this.filters()));
  protected readonly panelInvestment = computed(() => this.investmentOfPanel());
  protected readonly summary = computed(() => this.describeSummary());
  protected readonly stats = computed(() => this.describeStats());
  protected readonly cdiNote = computed(() => this.describeCdiNote());
  protected readonly slices = computed(() => distribution(this.lines()));
  protected readonly monthLabels = computed(() => this.months().map((key) => this.monthName(key)));
  protected readonly valueSeries = computed(() => this.describeValueSeries());
  protected readonly returnSeries = computed(() => this.describeReturnSeries());
  protected readonly monthlyGains = computed(() => this.describeMonthlyGains());
  protected readonly monthlyIncome = computed(() => this.describeMonthlyIncome());
  protected readonly incomeNote = computed(() => this.describeIncomeNote());
  protected readonly formatAxisMoney = (reais: number): string => this.compact(reais);
  protected readonly formatAxisPercent = (percent: number): string => `${Math.round(percent)}%`;
  protected readonly formatCentsAxis = (cents: number): string => this.compact(cents / 100);

  private readonly months = computed(() => monthKeys(this.today, this.filters().months));

  protected open(panel: Panel): void {
    this.isImportOpen.set(false);
    this.panel.set(panel);
  }

  protected openImport(): void {
    this.panel.set(CLOSED);
    this.importResult.set(undefined);
    this.isImportOpen.set(true);
  }

  protected finishImport(result: MovementImportResult): void {
    this.isImportOpen.set(false);
    this.importResult.set(result);
  }

  protected close(): void {
    this.panel.set(CLOSED);
  }

  protected pickKind(kind: InvestmentKind | undefined): void {
    this.filters.update((current) => ({ ...current, kind, investmentId: undefined }));
  }

  protected pickPeriod(months: PeriodMonths): void {
    this.filters.update((current) => ({ ...current, months }));
  }

  protected pickAsset(investmentId: string | undefined): void {
    this.filters.update((current) => ({ ...current, investmentId }));
  }

  /** Clicking the asset already picked goes back to all of them. */
  protected toggleAsset(investmentId: string): void {
    this.pickAsset(this.filters().investmentId === investmentId ? undefined : investmentId);
  }

  protected async saveInvestment(draft: InvestmentDraft): Promise<void> {
    const panel = this.panel();
    const id = panel.kind === 'edit' ? panel.investmentId : undefined;
    if (await this.store.saveInvestment(id, draft)) this.close();
  }

  protected async deleteInvestment(): Promise<void> {
    const panel = this.panel();
    if (panel.kind !== 'edit') return;
    if (await this.store.deleteInvestment(panel.investmentId)) this.close();
  }

  protected async addTrade(fields: TradeFields): Promise<void> {
    const panel = this.panel();
    if (panel.kind !== 'trade') return;
    if (await this.store.addTrade({ ...fields, investmentId: panel.investmentId })) this.close();
  }

  protected async addIncome(fields: IncomeFields): Promise<void> {
    const panel = this.panel();
    if (panel.kind !== 'income') return;
    if (await this.store.addIncome({ ...fields, investmentId: panel.investmentId })) this.close();
  }

  protected async removeMovement(movement: Movement): Promise<void> {
    if (movement.type === 'trade') await this.store.deleteTrade(movement.id);
    else await this.store.deleteIncome(movement.id);
  }

  protected reload(): void {
    this.store.reload();
  }

  protected kindLabel(investment: Investment): string {
    return investmentKindLabel(investment.kind);
  }

  protected quantity(line: PortfolioLine): string {
    return quantityText(line.quantityThousandths);
  }

  protected average(line: PortfolioLine): string {
    return formatMoney(averagePriceCents(line), this.locale);
  }

  protected priceText(investment: Investment): string {
    if (investment.price === undefined) return 'No price yet';
    return formatMoney(investment.price.cents, this.locale);
  }

  protected priceDay(investment: Investment): string {
    return investment.price === undefined ? '' : shortDateLabel(investment.price.on, this.locale);
  }

  protected costText(line: PortfolioLine): string {
    return formatMoney(line.costCents, this.locale);
  }

  protected valueText(line: PortfolioLine): string {
    return line.valueCents === undefined ? 'At cost' : formatMoney(line.valueCents, this.locale);
  }

  protected gainText(line: PortfolioLine): string {
    if (line.gainCents === undefined) return '';
    return `${formatSignedMoney(line.gainCents, this.locale)} (${formatPercent(this.percentOf(line.gainCents, line.costCents), this.locale)})`;
  }

  protected movementDetail(movement: Movement): string {
    const day = shortDateLabel(movement.date, this.locale);
    return `${day} · ${movement.investmentName} · ${movement.label}`;
  }

  protected signed(cents: number): string {
    return formatSignedMoney(cents, this.locale);
  }

  private sortedTableLines(): PortfolioLine[] {
    return filterLines(this.lines(), { kind: this.filters().kind }).sort(
      (first, second) => lineValueCents(second) - lineValueCents(first),
    );
  }

  private investmentOfPanel(): Investment | undefined {
    const panel = this.panel();
    if (panel.kind === 'closed' || panel.kind === 'new') return undefined;
    return this.lines().find((line) => line.investment.id === panel.investmentId)?.investment;
  }

  private describeSummary(): string {
    const portfolio = this.store.portfolio();
    if (portfolio === undefined) return 'Portfolio: —';
    return `Portfolio: ${formatMoney(portfolio.totals.valueCents, this.locale)}`;
  }

  private describeScope(): string {
    const { investmentId, kind } = this.filters();
    if (investmentId !== undefined) {
      return (
        this.lines().find((line) => line.investment.id === investmentId)?.investment.name ?? ''
      );
    }
    return kind === undefined ? 'whole portfolio' : investmentKindLabel(kind);
  }

  private describeStats(): Stat[] {
    if (!this.isLoaded()) return this.placeholderStats();
    const lines = this.selected();
    const value = lines.reduce((total, line) => total + lineValueCents(line), 0);
    const cost = lines.reduce((total, line) => total + line.costCents, 0);
    const gain = value - cost;
    return [
      {
        label: `Current value · ${this.describeScope()}`,
        value: formatMoney(value, this.locale),
        note: `${formatSignedMoney(gain, this.locale)} (${formatPercent(this.percentOf(gain, cost), this.locale)}) since purchase`,
      },
      { label: 'Invested', value: formatMoney(cost, this.locale), note: 'Sum at cost' },
      {
        label: 'Return',
        value: formatPercent(this.percentOf(gain, cost), this.locale),
        note: this.describeCdiComparison(),
      },
      {
        label: `Proventos · ${this.filters().months} months`,
        value: formatBalance(this.incomeInPeriod(), this.locale),
        note: 'Dividends and yields',
      },
    ];
  }

  private placeholderStats(): Stat[] {
    return ['Current value', 'Invested', 'Return', 'Proventos'].map((label) => ({
      label,
      value: '—',
    }));
  }

  private describeCdiComparison(): string {
    const performance = this.store.portfolio()?.performance;
    const isWhole = this.filters().kind === undefined && this.filters().investmentId === undefined;
    if (performance === undefined || !isWhole) return 'Since purchase';
    return `CDI on the same money: ${formatPercent(performance.cdiPercent, this.locale)}`;
  }

  private incomeInPeriod(): number {
    return this.monthlyIncome().reduce((total, cents) => total + cents, 0);
  }

  private selectedIds(): Set<string> {
    return new Set(this.selected().map((line) => line.investment.id));
  }

  private describeMonthlyIncome(): number[] {
    const incomes = this.store.portfolio()?.incomes ?? [];
    return incomeByMonth(incomes, this.selectedIds(), this.months());
  }

  private describeIncomeNote(): string {
    const average = Math.round(this.incomeInPeriod() / this.months().length);
    return `Average ${formatMoney(average, this.locale)} per month`;
  }

  /** The history is the whole portfolio's, so it is only drawn when nothing narrows it down. */
  private wholeHistory(): (MonthlyPoint | undefined)[] {
    const { kind, investmentId } = this.filters();
    const history = this.store.portfolio()?.history ?? [];
    if (kind !== undefined || investmentId !== undefined) return this.months().map(() => undefined);
    return this.months().map((month) => history.find((point) => point.month === month));
  }

  private describeValueSeries(): ChartSeries[] {
    const trades = this.store.portfolio()?.trades ?? [];
    const applied = appliedByMonth(trades, this.selectedIds(), this.months());
    return [
      { name: 'Current value', values: this.wholeHistory().map((point) => point?.valueCents) },
      { name: 'Applied', values: applied, dashed: true },
    ].map((series) => ({ ...series, values: series.values.map(this.toReais) }));
  }

  private describeReturnSeries(): ChartSeries[] {
    const history = this.wholeHistory();
    return [
      { name: 'Your investments', values: history.map((point) => point?.returnPercent) },
      { name: 'CDI', values: history.map((point) => point?.cdiPercent), dashed: true },
    ];
  }

  private describeMonthlyGains(): number[] {
    const history = this.wholeHistory();
    return history.map((point, index) => {
      const previous = history[index - 1];
      if (point === undefined || previous === undefined) return 0;
      const gain = point.valueCents - point.appliedCents;
      return gain - (previous.valueCents - previous.appliedCents);
    });
  }

  private describeCdiNote(): string | undefined {
    const portfolio = this.store.portfolio();
    const performance = portfolio?.performance;
    if (portfolio === undefined || performance === undefined) return undefined;
    const notes: string[] = [];
    if (performance.cdiThrough === undefined) notes.push('CDI rates could not be loaded.');
    else notes.push(`CDI rates through ${shortDateLabel(performance.cdiThrough, this.locale)}.`);
    if (portfolio.totals.unpricedCount > 0) {
      notes.push(`${portfolio.totals.unpricedCount} without a price are valued at cost.`);
    }
    return notes.join(' ');
  }

  private percentOf(part: number, whole: number): number {
    return whole === 0 ? 0 : (part / whole) * 100;
  }

  private readonly toReais = (cents: number | undefined): number | undefined =>
    cents === undefined ? undefined : cents / 100;

  private monthName(key: string): string {
    const date = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1);
    return new Intl.DateTimeFormat(this.locale, { month: 'short' }).format(date);
  }

  private compact(reais: number): string {
    return new Intl.NumberFormat(this.locale, {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(reais);
  }
}
