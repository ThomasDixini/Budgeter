import { Component, LOCALE_ID, computed, inject, signal } from '@angular/core';
import { LineChart } from '../../../components/line-chart/line-chart';
import { LoadFailed } from '../../../components/load-failed/load-failed';
import { PageHeading } from '../../../components/page-heading/page-heading';
import { formatPercent } from '../../../core/finances/investments';
import { formatBalance, formatMoney, formatSignedMoney } from '../../../core/finances/money';
import {
  NetWorthPoint,
  NetWorthRow,
  netWorthGrowth,
  netWorthRows,
} from '../../../core/finances/net-worth';
import { NetWorthStore } from '../../../core/finances/net-worth-store';
import { Period, periodMonths } from '../../../core/finances/period';
import { PeriodFilter } from '../../../components/period-filter/period-filter';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

interface Stat {
  readonly label: string;
  readonly value: string;
  readonly note?: string;
}

interface Composition {
  readonly label: string;
  readonly value: string;
  readonly isTotal: boolean;
}

interface TableRow {
  readonly month: string;
  readonly worth: string;
  readonly change: string;
  readonly percent: string;
  readonly isLoss: boolean;
}

/**
 * Net worth: what is owned (bank balances and investments) minus what the cards owe, how it moved over
 * the chosen period, and what it is made of. Today's figures are read from the other Finances pages'
 * data; the evolution stays empty until the store has month-end history.
 */
@Component({
  selector: 'app-finances-net-worth',
  imports: [TranslatePipe, PageHeading, LoadFailed, LineChart, PeriodFilter],
  providers: [NetWorthStore],
  templateUrl: './net-worth.html',
  styleUrl: './net-worth.css',
})
export class NetWorth {
  private readonly store = inject(NetWorthStore);
  private readonly locale = inject(LOCALE_ID);

  protected readonly isLoaded = this.store.isLoaded;
  protected readonly hasLoadFailed = this.store.hasLoadFailed;
  protected readonly worth = this.store.netWorth;
  protected readonly unpricedCount = this.store.unpricedCount;
  protected readonly today = this.store.today;
  protected readonly period = signal<Period>({ kind: 'months', months: 12 });
  private readonly months = computed(() => periodMonths(this.period(), this.today));
  protected readonly points = computed(() => this.pointsInPeriod());
  protected readonly stats = computed(() => this.describeStats());
  protected readonly composition = computed(() => this.describeComposition());
  protected readonly rows = computed(() => this.describeRows());
  protected readonly labels = computed(() =>
    this.points().map((point) => this.monthShort(point.month)),
  );
  protected readonly series = computed(() => [
    { name: 'Net worth', values: this.points().map((point) => point.cents / 100) },
  ]);
  protected readonly formatAxis = (reais: number): string =>
    new Intl.NumberFormat(this.locale, { notation: 'compact', maximumFractionDigits: 1 }).format(
      reais,
    );

  protected money(cents: number): string {
    return formatMoney(cents, this.locale);
  }

  protected balance(cents: number): string {
    return formatBalance(cents, this.locale);
  }

  protected reload(): void {
    this.store.reload();
  }

  private pointsInPeriod(): NetWorthPoint[] {
    const keys = new Set(this.months());
    return this.store.history().filter((point) => keys.has(point.month));
  }

  // Figures stay blank until everything has arrived, so a partial sum is never read as the total.
  private describeStats(): Stat[] {
    const show = (text: string): string => (this.isLoaded() ? text : '—');
    const growth = netWorthGrowth(this.points());
    return [
      {
        label: 'Net worth today',
        value: show(formatBalance(this.worth().totalCents, this.locale)),
      },
      {
        label: 'Growth in period',
        value: growth ? formatSignedMoney(growth.growthCents, this.locale) : '—',
        note:
          growth &&
          `${formatPercent(growth.growthPercent, this.locale)} in ${this.months().length} months`,
      },
      {
        label: 'Average per month',
        value: growth ? formatSignedMoney(growth.averageCents, this.locale) : '—',
      },
      {
        label: 'Best month',
        value: growth ? formatSignedMoney(growth.best.changeCents, this.locale) : '—',
        note: growth && this.monthLong(growth.best.month),
      },
    ];
  }

  private describeComposition(): Composition[] {
    const worth = this.worth();
    const show = (text: string): string => (this.isLoaded() ? text : '—');
    return [
      {
        label: 'Cash in accounts',
        value: show(formatBalance(worth.bankCents, this.locale)),
        isTotal: false,
      },
      {
        label: 'Investments',
        value: show(formatBalance(worth.investmentsCents, this.locale)),
        isTotal: false,
      },
      { label: 'Open invoices', value: show(this.owed(worth.cardsOwedCents)), isTotal: false },
      {
        label: 'Net worth',
        value: show(formatBalance(worth.totalCents, this.locale)),
        isTotal: true,
      },
    ];
  }

  private owed(cents: number): string {
    return cents === 0 ? formatMoney(0, this.locale) : `−${formatMoney(cents, this.locale)}`;
  }

  private describeRows(): TableRow[] {
    return netWorthRows(this.points())
      .reverse()
      .map((row: NetWorthRow) => ({
        month: this.monthLong(row.month),
        worth: formatBalance(row.cents, this.locale),
        change: formatSignedMoney(row.changeCents, this.locale),
        percent: formatPercent(row.changePercent, this.locale),
        isLoss: row.changeCents < 0,
      }));
  }

  private monthShort(key: string): string {
    return new Intl.DateTimeFormat(this.locale, { month: 'short' }).format(this.firstOf(key));
  }

  private monthLong(key: string): string {
    return new Intl.DateTimeFormat(this.locale, { month: 'long', year: 'numeric' }).format(
      this.firstOf(key),
    );
  }

  private firstOf(key: string): Date {
    return new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1);
  }
}
