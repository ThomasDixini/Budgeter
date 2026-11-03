import { Component, LOCALE_ID, computed, inject, input, output } from '@angular/core';
import { shortDateLabel } from '../../../../core/calendar/date-label';
import { AccountStatement, CardStatement } from '../../../../core/finances/account-statement';
import { Account, accountKindLabel } from '../../../../core/finances/finance-references';
import { formatBalance } from '../../../../core/finances/money';

/** Shown instead of a balance that has not arrived yet (e.g. right after adding an account). */
const PENDING_VALUE = '—';

/** The figure a tile leads with and what it is. */
interface TileFigure {
  readonly valueLabel: string;
  readonly value: string;
}

/** What one tile shows. */
interface AccountTile extends TileFigure {
  readonly id: string;
  readonly name: string;
  readonly isCard: boolean;
  readonly kindLabel: string;
}

/** One tile per bank account and credit card, with its balance or invoice; a tile selects its account. */
@Component({
  selector: 'app-account-tiles',
  templateUrl: './account-tiles.html',
  styleUrl: './account-tiles.css',
})
export class AccountTiles {
  readonly accounts = input.required<readonly Account[]>();
  readonly statements = input.required<ReadonlyMap<string, AccountStatement>>();
  readonly selectedId = input<string>();
  readonly choose = output<string>();

  private readonly locale = inject(LOCALE_ID);

  protected readonly tiles = computed(() =>
    this.accounts().map((account) => this.tileOf(account, this.statements().get(account.id))),
  );

  private tileOf(account: Account, statement: AccountStatement | undefined): AccountTile {
    const isCard = account.kind === 'creditCard';
    return {
      id: account.id,
      name: account.name,
      isCard,
      kindLabel: accountKindLabel(account.kind),
      ...(isCard ? this.cardFigure(statement?.card) : this.bankFigure(statement)),
    };
  }

  private bankFigure(statement: AccountStatement | undefined): TileFigure {
    const cents = statement?.balanceCents;
    return {
      valueLabel: 'Balance',
      value: cents === undefined ? PENDING_VALUE : formatBalance(cents, this.locale),
    };
  }

  // What needs paying first: a closed invoice still owed, else the invoice purchases go to now.
  private cardFigure(card: CardStatement | undefined): TileFigure {
    if (card === undefined) return { valueLabel: 'Current invoice', value: PENDING_VALUE };
    if (card.amountDueCents > 0) {
      return {
        valueLabel: `To pay · due ${shortDateLabel(card.closedInvoice.dueOn, this.locale)}`,
        value: formatBalance(card.amountDueCents, this.locale),
      };
    }
    return {
      valueLabel: `Current invoice · due ${shortDateLabel(card.openInvoice.dueOn, this.locale)}`,
      value: formatBalance(card.openInvoice.amountCents, this.locale),
    };
  }
}
