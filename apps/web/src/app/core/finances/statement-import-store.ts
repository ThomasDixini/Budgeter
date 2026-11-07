import { ErrorHandler, Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CardPayment } from './account-statement';
import { AccountStatementsGateway } from './account-statements-gateway';
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
