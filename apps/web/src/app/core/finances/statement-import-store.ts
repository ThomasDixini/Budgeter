import { ErrorHandler, Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CardPayment } from './account-statement';
import { AccountStatementsGateway } from './account-statements-gateway';
import { CategoryMemory, rememberCategories } from './statement-import';
import { Transaction } from './transaction';
import { TransactionsStore } from './transactions-store';

/** What a statement import writes: transactions, and payments of card invoices. */
export interface StatementBatch {
  readonly transactions: readonly Transaction[];
  readonly payments: readonly CardPayment[];
}

/**
 * Reads and writes what a bank statement import needs: which of its lines are stored already, and the
 * saving of the ones the person kept, as transactions or as card payments.
 */
@Injectable({ providedIn: 'root' })
export class StatementImportStore {
  private readonly transactions = inject(TransactionsStore);
  private readonly statements = inject(AccountStatementsGateway);
  private readonly errorHandler = inject(ErrorHandler);

  /**
   * The ids of the transactions and card payments already stored in the given `YYYY-MM` months.
   * @example await store.storedIds(['2026-10']) // Set { 'groceries', 'september-invoice' }
   */
  async storedIds(months: readonly string[]): Promise<Set<string>> {
    const [transactionIds, paymentLists] = await Promise.all([
      this.transactions.storedIds(months),
      Promise.all(
        months.map((month) =>
          firstValueFrom(this.statements.paymentsInMonth(month), { defaultValue: [] }),
        ),
      ),
    ]);
    return new Set([...transactionIds, ...paymentLists.flat().map((payment) => payment.id)]);
  }

  /**
   * What the categories of the past months say about each description: the months before and including
   * the given `YYYY-MM` one, `count` of them.
   * @example await store.categoryMemory('2026-10', 6) // Map { 'out|padaria' => 'food' }
   */
  async categoryMemory(month: string, count: number): Promise<CategoryMemory> {
    return rememberCategories(await this.transactions.inMonths(monthsUpTo(month, count)));
  }

  /**
   * Saves the transactions and the card payments; a refusal is reported and counted, and the rest still
   * go through.
   * @example await store.importAll({ transactions, payments }) // { saved: 22, failed: 0 }
   */
  async importAll(batch: StatementBatch): Promise<{ saved: number; failed: number }> {
    const done = await this.transactions.addAll(batch.transactions);
    let failed = done.failed;
    for (const payment of batch.payments) {
      if (!(await this.tryToSave(payment))) failed++;
    }
    return { saved: batch.transactions.length + batch.payments.length - failed, failed };
  }

  private async tryToSave(payment: CardPayment): Promise<boolean> {
    try {
      await firstValueFrom(this.statements.savePayment(payment), { defaultValue: payment });
      return true;
    } catch (error) {
      this.errorHandler.handleError(error);
      return false;
    }
  }
}

/**
 * The `count` months ending at a `YYYY-MM` month, oldest first.
 * @example monthsUpTo('2026-02', 3) // ['2025-12', '2026-01', '2026-02']
 */
export function monthsUpTo(month: string, count: number): string[] {
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
  return Array.from({ length: count }, (_, position) => {
    const at = index - (count - 1 - position);
    return `${Math.floor(at / 12)}-${String((at % 12) + 1).padStart(2, '0')}`;
  });
}
