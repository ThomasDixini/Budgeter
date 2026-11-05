import { Component, input, output } from '@angular/core';
import { fieldValue } from '../../../../core/forms/field-value';
import { Account } from '../../../../core/finances/finance-references';
import {
  TYPE_FILTER_OPTIONS,
  TransactionFilters,
  TypeFilter,
} from '../../../../core/finances/transaction-filters';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

/** Search box, income/expense switch and account chips above the transactions list. */
@Component({
  selector: 'app-filters-bar',
  imports: [TranslatePipe],
  templateUrl: './filters-bar.html',
  styleUrl: './filters-bar.css',
})
export class FiltersBar {
  readonly accounts = input.required<readonly Account[]>();
  readonly filters = input.required<TransactionFilters>();
  readonly filtersChange = output<TransactionFilters>();

  protected readonly typeOptions = TYPE_FILTER_OPTIONS;

  protected changeQuery(event: Event): void {
    this.filtersChange.emit({ ...this.filters(), query: fieldValue(event) });
  }

  protected changeType(type: TypeFilter): void {
    this.filtersChange.emit({ ...this.filters(), type });
  }

  protected changeAccount(accountId: string | undefined): void {
    this.filtersChange.emit({ ...this.filters(), accountId });
  }
}
