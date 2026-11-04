import { CardPayment } from '../account-statement';
import { Account } from '../finance-references';
import { Transaction } from '../transaction';
import { invoiceCycleOf, statementsAt } from './demo-statements';

const TERMS = { limitCents: 500_000, closingDay: 3, dueDay: 10 };

const ACCOUNTS: Account[] = [
  { id: 'checking', name: 'Checking', kind: 'bankAccount', openingBalanceCents: 100_000 },
  { id: 'card', name: 'Card', kind: 'creditCard', openingBalanceCents: 0, card: TERMS },
];

function purchase(id: string, date: string, cents: number, accountId = 'card'): Transaction {
  return { id, date, description: id, categoryId: 'food', accountId, amountCents: -cents };
}

describe('invoiceCycleOf', () => {
  it('puts a purchase before the closing day on the invoice that closes this month', () => {
    expect(invoiceCycleOf('2026-10-20', TERMS)).toEqual({
      startsOn: '2026-10-03',
      closesOn: '2026-11-03',
      dueOn: '2026-11-10',
    });
  });

  it('puts a purchase on the closing day on the next invoice', () => {
    expect(invoiceCycleOf('2026-11-03', TERMS).closesOn).toBe('2026-12-03');
  });

  it('is due the month after it closes when the due day is not after the closing day', () => {
    expect(invoiceCycleOf('2026-10-20', { ...TERMS, closingDay: 25, dueDay: 5 }).dueOn).toBe(
      '2026-11-05',
    );
  });
});

describe('statementsAt', () => {
  const transactions: Transaction[] = [
    {
      id: 'salary',
      date: '2026-10-05',
      description: 'Salary',
      categoryId: 'salary',
      accountId: 'checking',
      amountCents: 300_000,
    },
    purchase('closed-purchase', '2026-09-20', 40_000),
    purchase('open-purchase', '2026-10-20', 25_000),
    purchase('later', '2026-11-20', 99_000),
  ];

  it('holds the opening balance plus what came in, minus what was paid to the card', () => {
    const payment: CardPayment = {
      id: 'p',
      cardId: 'card',
      fromAccountId: 'checking',
      date: '2026-10-10',
      amountCents: 10_000,
    };

    const [checking] = statementsAt(ACCOUNTS, transactions, [payment], '2026-10-31');

    expect(checking.balanceCents).toBe(100_000 + 300_000 - 10_000);
  });

  it('splits what the card owes between the open invoice and the closed one still to pay', () => {
    const [, card] = statementsAt(ACCOUNTS, transactions, [], '2026-10-31');

    expect([
      card.balanceCents,
      card.card?.openInvoice.amountCents,
      card.card?.closedInvoice.amountCents,
      card.card?.amountDueCents,
      card.card?.availableLimitCents,
    ]).toEqual([-65_000, 25_000, 40_000, 40_000, 435_000]);
  });

  it('owes less once a payment arrives, and ignores what has not happened yet', () => {
    const payment: CardPayment = {
      id: 'p',
      cardId: 'card',
      fromAccountId: 'checking',
      date: '2026-10-10',
      amountCents: 40_000,
    };

    const [, card] = statementsAt(ACCOUNTS, transactions, [payment], '2026-10-31');

    expect([card.balanceCents, card.card?.amountDueCents]).toEqual([-25_000, 0]);
  });
});
