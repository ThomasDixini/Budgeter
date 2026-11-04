import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { Clock } from '../../calendar/clock';
import { FixedClock } from '../../calendar/fixed-clock';
import { DemoFinances } from './demo-finances';
import {
  DemoAccountStatementsGateway,
  DemoBillsGateway,
  DemoFinanceReferencesGateway,
  DemoIncomeSplitGateway,
  DemoInvestmentsGateway,
  DemoTransactionsGateway,
} from './demo-gateways';

/** Wednesday, November 4, 2026. */
const NOW = new Date(2026, 10, 4, 10, 0);

function setup(): {
  demo: DemoFinances;
  transactions: DemoTransactionsGateway;
  references: DemoFinanceReferencesGateway;
  statements: DemoAccountStatementsGateway;
  bills: DemoBillsGateway;
  split: DemoIncomeSplitGateway;
  investments: DemoInvestmentsGateway;
} {
  TestBed.configureTestingModule({
    providers: [
      { provide: Clock, useValue: new FixedClock(NOW) },
      DemoTransactionsGateway,
      DemoFinanceReferencesGateway,
      DemoAccountStatementsGateway,
      DemoBillsGateway,
      DemoIncomeSplitGateway,
      DemoInvestmentsGateway,
    ],
  });
  return {
    demo: TestBed.inject(DemoFinances),
    transactions: TestBed.inject(DemoTransactionsGateway),
    references: TestBed.inject(DemoFinanceReferencesGateway),
    statements: TestBed.inject(DemoAccountStatementsGateway),
    bills: TestBed.inject(DemoBillsGateway),
    split: TestBed.inject(DemoIncomeSplitGateway),
    investments: TestBed.inject(DemoInvestmentsGateway),
  };
}

describe('demo gateways', () => {
  it('lists a month of transactions newest first, and keeps one that is added or deleted', async () => {
    const { transactions } = setup();
    const october = await firstValueFrom(transactions.listMonth('2026-10'));
    const added = {
      id: 'mine',
      date: '2026-10-31',
      description: 'Mine',
      categoryId: 'food',
      accountId: 'checking-account',
      amountCents: -1000,
    };

    await firstValueFrom(transactions.save(added));
    const withIt = await firstValueFrom(transactions.listMonth('2026-10'));
    await firstValueFrom(transactions.delete('mine'));

    expect([
      october.length > 20,
      october.every((item, index) => index === 0 || october[index - 1].date >= item.date),
      withIt.length - october.length,
      (await firstValueFrom(transactions.listMonth('2026-10'))).length,
    ]).toEqual([true, true, 1, october.length]);
  });

  it('serves categories by name and accounts, and refuses to delete what was recorded on', async () => {
    const { references } = setup();
    const categories = await firstValueFrom(references.categories());
    const accounts = await firstValueFrom(references.accounts());

    await expect(firstValueFrom(references.deleteCategory('food'))).rejects.toThrow(
      'nothing was recorded under',
    );
    await expect(firstValueFrom(references.deleteAccount('credit-card'))).rejects.toThrow(
      'nothing was recorded on',
    );

    expect([
      categories.map((item) => item.name).slice(0, 2),
      accounts.map((item) => item.kind),
    ]).toEqual([
      ['Education', 'Extra income'],
      ['bankAccount', 'bankAccount', 'creditCard'],
    ]);
  });

  it('works the balances and the card invoices out of its own transactions', async () => {
    const { statements } = setup();

    const [checking, savings, card] = await firstValueFrom(statements.statements('2026-11-04'));

    expect([
      checking.balanceCents > 0,
      savings.balanceCents > 1_500_000,
      (card.card?.closedInvoice.amountCents ?? 0) > 0,
    ]).toEqual([true, true, true]);
  });

  it('shows what is overdue, what comes next and the invoices to pay, and records a bill when it is settled', async () => {
    const { bills, transactions } = setup();
    const agenda = await firstValueFrom(bills.agenda('2026-11-04'));
    const overdue = agenda.bills.find(
      (bill) => bill.settlement === undefined && bill.dueDate < '2026-11-04',
    )!;
    const before = (await firstValueFrom(transactions.listMonth('2026-11'))).length;

    await firstValueFrom(
      bills.settle(overdue.id, { date: '2026-11-04', accountId: 'checking-account' }),
    );
    const settledToday = (await firstValueFrom(transactions.listMonth('2026-11'))).find(
      (item) => item.date === '2026-11-04' && item.description === overdue.description,
    );
    await firstValueFrom(bills.reopen(overdue.id));

    expect([
      agenda.cardInvoices.some((invoice) => invoice.isClosed),
      (await firstValueFrom(transactions.listMonth('2026-11'))).length,
      before,
      settledToday?.amountCents,
    ]).toEqual([true, before, before, -overdue.amountCents]);
  });

  it('creates every occurrence of a bill that repeats', async () => {
    const { bills } = setup();

    const made = await firstValueFrom(
      bills.save('gym', {
        kind: 'payable',
        description: 'Gym',
        categoryId: 'health',
        amountCents: 9000,
        dueDate: '2026-12-31',
        repeat: { kind: 'monthly', count: 3 },
      }),
    );

    expect(made.map((bill) => [bill.id, bill.dueDate, bill.series?.number])).toEqual([
      ['gym', '2026-12-31', 1],
      ['gym-2', '2027-01-31', 2],
      ['gym-3', '2027-02-28', 3],
    ]);
  });

  it('keeps and gives back the income split plan', async () => {
    const { split } = setup();
    const plan = await firstValueFrom(split.get());

    await firstValueFrom(split.save({ ...plan, baseIncomeCents: 1 }));

    expect([plan.parts.length, (await firstValueFrom(split.get())).baseIncomeCents]).toEqual([
      3, 1,
    ]);
  });

  it('works the portfolio out and records a trade', async () => {
    const { investments } = setup();
    const before = await firstValueFrom(investments.portfolio('2026-11-04'));

    await firstValueFrom(
      investments.saveTrade('extra', {
        investmentId: 'demo-petr4',
        date: '2026-11-04',
        kind: 'buy',
        quantityThousandths: 10_000,
        unitPriceCents: 3900,
      }),
    );
    const after = await firstValueFrom(investments.portfolio('2026-11-04'));

    expect([
      before.totals.valueCents > 0,
      after.totals.costCents - before.totals.costCents,
      (before.history?.length ?? 0) > 6,
    ]).toEqual([true, 39_000, true]);
  });

  it('gives the net worth of each of the last twelve months', () => {
    const { demo } = setup();

    const history = demo.netWorthHistory();

    expect([
      history.length,
      history[0].month,
      history[11].month,
      history.every((point) => point.cents > 0),
    ]).toEqual([12, '2025-12', '2026-11', true]);
  });
});
