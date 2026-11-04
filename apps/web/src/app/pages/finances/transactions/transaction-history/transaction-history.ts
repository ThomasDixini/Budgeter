import { Component, LOCALE_ID, inject, input, output } from '@angular/core';
import { longDateLabel, parseIsoDate } from '../../../../core/calendar/date-label';
import { formatSignedMoney } from '../../../../core/finances/money';
import { Transaction } from '../../../../core/finances/transaction';
import { TransactionDay } from '../../../../core/finances/transaction-days';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

/** The month's transactions grouped by day, each day with its total; a row opens it for editing. */
@Component({
  selector: 'app-transaction-history',
  imports: [TranslatePipe],
  templateUrl: './transaction-history.html',
  styleUrl: './transaction-history.css',
})
export class TransactionHistory {
  readonly days = input.required<readonly TransactionDay[]>();
  readonly categoryNames = input.required<ReadonlyMap<string, string>>();
  readonly accountNames = input.required<ReadonlyMap<string, string>>();
  readonly edit = output<Transaction>();

  private readonly locale = inject(LOCALE_ID);

  protected dayLabel(isoDay: string): string {
    return longDateLabel(parseIsoDate(isoDay), this.locale);
  }

  protected signed(cents: number): string {
    return formatSignedMoney(cents, this.locale);
  }

  /**
   * What a screen reader says for a row: the parts are separate elements, which it would otherwise
   * read run together ("GroceriesCredit card").
   */
  protected rowLabel(transaction: Transaction): string {
    const parts = [
      transaction.description,
      this.accountNames().get(transaction.accountId),
      this.categoryNames().get(transaction.categoryId),
      this.signed(transaction.amountCents),
    ];
    return `Edit ${parts.filter((part) => part !== undefined).join(', ')}`;
  }
}
