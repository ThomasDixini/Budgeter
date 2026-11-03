import { Component, LOCALE_ID, computed, inject } from '@angular/core';
import { LoadFailed } from '../../../components/load-failed/load-failed';
import { PageHeading } from '../../../components/page-heading/page-heading';
import { formatBalance, formatMoney } from '../../../core/finances/money';
import { NetWorthStore } from '../../../core/finances/net-worth-store';

/**
 * Net worth: what is owned (bank balances and investments) minus what the cards owe, with the assets
 * split between bank accounts and investments. Everything is read from the other Finances pages' data.
 */
@Component({
  selector: 'app-finances-net-worth',
  imports: [PageHeading, LoadFailed],
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
  protected readonly stats = computed(() => this.describeStats());
  protected readonly hasAssets = computed(() => this.worth().assetsCents > 0);

  protected money(cents: number): string {
    return formatMoney(cents, this.locale);
  }

  protected balance(cents: number): string {
    return formatBalance(cents, this.locale);
  }

  protected reload(): void {
    this.store.reload();
  }

  // Figures stay blank until everything has arrived, so a partial sum is never read as the total.
  private describeStats(): { label: string; value: string }[] {
    const worth = this.worth();
    const show = (text: string): string => (this.isLoaded() ? text : '—');
    return [
      { label: 'Net worth', value: show(formatBalance(worth.totalCents, this.locale)) },
      { label: 'Assets', value: show(formatBalance(worth.assetsCents, this.locale)) },
      { label: 'Owed on cards', value: show(formatMoney(worth.cardsOwedCents, this.locale)) },
    ];
  }
}
