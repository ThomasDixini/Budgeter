import {
  AccountMovement,
  accountTotals,
  bankMovements,
  invoiceMovements,
  moneyFlows,
  spendingByCategory,
} from './account-activity';
import { SAMPLE_PAYMENT, SAMPLE_STATEMENTS } from './fake-account-statements-gateway';
import { SAMPLE_ACCOUNTS, SAMPLE_OCTOBER } from './fake-finances-gateways';
import { Transaction } from './transaction';

const CARD_NAMES = new Map([['credit-card', 'Credit card']]);
const OCTOBER_31 = { month: '2026-10', today: '2026-10-31' };
const OPEN_INVOICE = SAMPLE_STATEMENTS[1].card!.openInvoice;

function onCard(id: string, date: string, amountCents: number): Transaction {
  return { id, date, description: id, categoryId: 'food', accountId: 'credit-card', amountCents };
}

function ids(movements: readonly AccountMovement[]): string[] {
  return movements.map((movement) => movement.id);
}

describe('bankMovements', () => {
  it("merges the account's transactions and the card payments made from it, newest first", () => {
    const movements = bankMovements(
      SAMPLE_OCTOBER,
      [SAMPLE_PAYMENT],
      'checking-account',
      OCTOBER_31,
      CARD_NAMES,
    );

    expect(ids(movements)).toEqual(['pharmacy', 'september-invoice', 'salary']);
  });

  it('shows a payment as money going out to the card', () => {
    const [payment] = bankMovements(
      [],
      [SAMPLE_PAYMENT],
      'checking-account',
      OCTOBER_31,
      CARD_NAMES,
    );

    expect([payment.description, payment.amountCents, payment.isCardPayment]).toEqual([
      'Invoice payment · Credit card',
      -41250,
      true,
    ]);
  });

  it('leaves out other months and days after today', () => {
    const movements = bankMovements(
      SAMPLE_OCTOBER,
      [SAMPLE_PAYMENT],
      'checking-account',
      { month: '2026-10', today: '2026-10-09' },
      CARD_NAMES,
    );

    expect(ids(movements)).toEqual(['salary']);
  });
});

describe('invoiceMovements', () => {
  it("keeps the card's purchases from the invoice's first day to the day before it closes", () => {
    const transactions = [
      onCard('before', '2026-10-02', -100),
      onCard('first-day', '2026-10-03', -200),
      onCard('closing-day', '2026-11-03', -300),
    ];

    expect(ids(invoiceMovements(transactions, 'credit-card', OPEN_INVOICE, '2026-11-05'))).toEqual([
      'first-day',
    ]);
  });

  it('leaves out purchases dated after today and on other accounts', () => {
    const movements = invoiceMovements(SAMPLE_OCTOBER, 'credit-card', OPEN_INVOICE, '2026-10-30');

    expect(movements).toEqual([]);
  });
});

describe('moneyFlows', () => {
  it('adds up what came in and what went out', () => {
    const movements = bankMovements(
      SAMPLE_OCTOBER,
      [SAMPLE_PAYMENT],
      'checking-account',
      OCTOBER_31,
      CARD_NAMES,
    );

    expect(moneyFlows(movements)).toEqual({ inCents: 950000, outCents: 5890 + 41250 });
  });
});

describe('spendingByCategory', () => {
  it('sums the expenses of each category, the largest first, without income or payments', () => {
    const movements = [
      ...bankMovements(
        SAMPLE_OCTOBER,
        [SAMPLE_PAYMENT],
        'checking-account',
        OCTOBER_31,
        CARD_NAMES,
      ),
      ...invoiceMovements(
        [onCard('a', '2026-10-04', -1000), onCard('b', '2026-10-05', -500)],
        'credit-card',
        OPEN_INVOICE,
        '2026-10-31',
      ),
    ];

    expect(spendingByCategory(movements)).toEqual([
      { categoryId: 'health', cents: 5890 },
      { categoryId: 'food', cents: 1500 },
    ]);
  });
});

describe('accountTotals', () => {
  it('adds up the bank balances and what the cards owe', () => {
    const balances = new Map(
      SAMPLE_STATEMENTS.map((statement) => [statement.accountId, statement.balanceCents]),
    );

    expect(accountTotals(SAMPLE_ACCOUNTS, balances)).toEqual({
      bankBalanceCents: 1002860,
      cardOwedCents: 28640,
    });
  });

  it('counts an account without a known balance as zero', () => {
    expect(accountTotals(SAMPLE_ACCOUNTS, new Map())).toEqual({
      bankBalanceCents: 0,
      cardOwedCents: 0,
    });
  });
});
