import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { BillKind, BillSettlement } from '../../../../core/finances/bills';
import { Account } from '../../../../core/finances/finance-references';
import { fieldValue } from '../../../../core/forms/field-value';

/**
 * Inline form to mark a bill paid or received: through which account and on which day (today to start
 * with). The API records the movement as a transaction on that account.
 */
@Component({
  selector: 'app-settle-form',
  templateUrl: './settle-form.html',
  styleUrl: './settle-form.css',
})
export class SettleForm {
  readonly description = input.required<string>();
  readonly kind = input.required<BillKind>();
  readonly accounts = input.required<readonly Account[]>();
  /** The day the settlement starts on, `YYYY-MM-DD`. */
  readonly today = input.required<string>();
  readonly confirm = output<BillSettlement>();
  readonly dismiss = output();

  protected readonly accountId = linkedSignal(() => this.accounts()[0]?.id ?? '');
  protected readonly date = linkedSignal(() => this.today());

  protected readonly verb = computed(() => (this.kind() === 'payable' ? 'paid' : 'received'));
  protected readonly accountLabel = computed(() =>
    this.kind() === 'payable' ? 'Paid from' : 'Received into',
  );
  protected readonly canSave = computed(() => this.accountId() !== '' && this.date() !== '');

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    if (!this.canSave()) return;
    this.confirm.emit({ date: this.date(), accountId: this.accountId() });
  }

  protected readonly valueOf = fieldValue;
}
