import { Component, LOCALE_ID, computed, inject, signal } from '@angular/core';
import { LoadFailed } from '../../../components/load-failed/load-failed';
import { PageHeading } from '../../../components/page-heading/page-heading';
import { shortDateLabel } from '../../../core/calendar/date-label';
import { formatBalance, formatMoney, formatSignedMoney } from '../../../core/finances/money';
import {
  Investment,
  InvestmentDraft,
  Movement,
  PortfolioLine,
  averagePriceCents,
  formatPercent,
  investmentKindLabel,
  quantityText,
} from '../../../core/finances/investments';
import { InvestmentsStore } from '../../../core/finances/investments-store';
import { IncomeFields, IncomeForm } from './income-form/income-form';
import { InvestmentForm } from './investment-form/investment-form';
import { TradeFields, TradeForm } from './trade-form/trade-form';

/** The inline form open above the lists, if any. */
type Panel =
  | { readonly kind: 'closed' }
  | { readonly kind: 'new' }
  | { readonly kind: 'edit'; readonly investmentId: string }
  | { readonly kind: 'trade'; readonly investmentId: string }
  | { readonly kind: 'income'; readonly investmentId: string };

const CLOSED: Panel = { kind: 'closed' };

/**
 * Investments: the portfolio (what is held, what it cost, what it is worth), how it did against the CDI,
 * the proventos received, and the purchases, sales and proventos behind it. Prices are typed by hand; the
 * CDI comes from the Central Bank through the API.
 */
@Component({
  selector: 'app-finances-investments',
  imports: [PageHeading, LoadFailed, InvestmentForm, TradeForm, IncomeForm],
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
  protected readonly lines = computed(() => this.store.portfolio()?.lines ?? []);
  protected readonly panelInvestment = computed(() => this.investmentOfPanel());
  protected readonly summary = computed(() => this.describeSummary());
  protected readonly stats = computed(() => this.describeStats());
  protected readonly cdiNote = computed(() => this.describeCdiNote());

  protected open(panel: Panel): void {
    this.panel.set(panel);
  }

  protected close(): void {
    this.panel.set(CLOSED);
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

  protected holding(line: PortfolioLine): string {
    const units = quantityText(line.quantityThousandths);
    if (line.quantityThousandths === 0) return 'No units held';
    const average = formatMoney(averagePriceCents(line), this.locale);
    return `${units} units · average ${average}`;
  }

  protected priceText(investment: Investment): string {
    if (investment.price === undefined) return 'No price yet';
    const price = formatMoney(investment.price.cents, this.locale);
    return `${price} · ${shortDateLabel(investment.price.on, this.locale)}`;
  }

  protected valueText(line: PortfolioLine): string {
    return line.valueCents === undefined ? 'At cost' : formatMoney(line.valueCents, this.locale);
  }

  protected gainText(line: PortfolioLine): string {
    if (line.gainCents === undefined) return '';
    const percent = line.costCents === 0 ? 0 : (line.gainCents / line.costCents) * 100;
    return `${formatSignedMoney(line.gainCents, this.locale)} (${formatPercent(percent, this.locale)})`;
  }

  protected movementDetail(movement: Movement): string {
    const day = shortDateLabel(movement.date, this.locale);
    return `${day} · ${movement.investmentName} · ${movement.label}`;
  }

  protected signed(cents: number): string {
    return formatSignedMoney(cents, this.locale);
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

  private describeStats(): { label: string; value: string; note?: string }[] {
    const portfolio = this.store.portfolio();
    const show = (text: string | undefined): string => (text === undefined ? '—' : text);
    const performance = portfolio?.performance;
    return [
      {
        label: 'Current value',
        value: show(portfolio && formatMoney(portfolio.totals.valueCents, this.locale)),
      },
      {
        label: 'Invested',
        value: show(portfolio && formatMoney(portfolio.totals.costCents, this.locale)),
      },
      {
        label: 'Gain',
        value: show(performance && formatSignedMoney(performance.gainCents, this.locale)),
        note: performance && formatPercent(performance.gainPercent, this.locale),
      },
      {
        label: 'CDI on the same money',
        value: show(performance && formatSignedMoney(performance.cdiGainCents, this.locale)),
        note: performance && formatPercent(performance.cdiPercent, this.locale),
      },
      {
        label: 'Proventos · 12 months',
        value: show(
          portfolio && formatBalance(portfolio.totals.incomeLast12MonthsCents, this.locale),
        ),
      },
    ];
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
}
