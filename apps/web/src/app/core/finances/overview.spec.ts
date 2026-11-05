import { billItem } from './bills';
import {
  flowMonths,
  flowPeak,
  latestTransactions,
  monthlyFlow,
  spendingByCategory,
  upcomingDues,
} from './overview';
import { Transaction } from './transaction';

function tx(id: string, date: string, amountCents: number, categoryId = 'food'): Transaction {
  return { id, date, description: id, categoryId, accountId: 'checking-account', amountCents };
}

describe('flowMonths', () => {
  it('ends at the current month and goes back across the year', () => {
    expect(flowMonths('2026-03')).toEqual([
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
    ]);
  });
});

describe('monthlyFlow', () => {
  it('adds up income and expenses per month, and a month with nothing is zero', () => {
    const flow = monthlyFlow(
      ['2026-09', '2026-10'],
      [[], [tx('salary', '2026-10-05', 950000), tx('lunch', '2026-10-06', -2000)]],
    );

    expect(flow).toEqual([
      { month: '2026-09', incomeCents: 0, expenseCents: 0 },
      { month: '2026-10', incomeCents: 950000, expenseCents: 2000 },
    ]);
  });
});

describe('flowPeak', () => {
  it('is the largest bar, and never zero', () => {
    expect(flowPeak([{ month: '2026-10', incomeCents: 500, expenseCents: 800 }])).toBe(800);
    expect(flowPeak([{ month: '2026-10', incomeCents: 0, expenseCents: 0 }])).toBe(1);
  });
});

describe('spendingByCategory', () => {
  const names = new Map([
    ['food', 'Food'],
    ['health', 'Health'],
  ]);

  it('ranks expense categories by amount with their share, ignoring income', () => {
    const spending = spendingByCategory(
      [
        tx('a', '2026-10-01', -7500, 'food'),
        tx('b', '2026-10-02', -2500, 'health'),
        tx('salary', '2026-10-03', 900000, 'salary'),
      ],
      names,
    );

    expect(spending).toEqual([
      { categoryId: 'food', name: 'Food', cents: 7500, percent: 75 },
      { categoryId: 'health', name: 'Health', cents: 2500, percent: 25 },
    ]);
  });

  it('groups the categories beyond the top five', () => {
    const transactions = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id, index) =>
      tx(id, '2026-10-01', -(1000 - index), id),
    );

    const spending = spendingByCategory(transactions, new Map());

    expect(spending.map((line) => line.name)).toEqual([
      'Unknown category',
      'Unknown category',
      'Unknown category',
      'Unknown category',
      'Unknown category',
      'Other categories',
    ]);
    expect(spending[5].cents).toBe(1989);
  });

  it('is empty when nothing was spent', () => {
    expect(spendingByCategory([tx('salary', '2026-10-03', 100)], names)).toEqual([]);
  });
});

describe('latestTransactions', () => {
  it('lists the newest days first, keeping the given order within a day', () => {
    const list = latestTransactions(
      [tx('old', '2026-09-30', -1), tx('late', '2026-10-05', -1), tx('early', '2026-10-05', -1)],
      2,
    );

    expect(list.map((item) => item.id)).toEqual(['late', 'early']);
  });
});

describe('upcomingDues', () => {
  it('lists open bills overdue first and then by due date, up to the count', () => {
    const bill = (id: string, dueDate: string, settled = false) =>
      billItem({
        id,
        kind: 'payable',
        description: id,
        categoryId: 'food',
        amountCents: 100,
        dueDate,
        settlement: settled ? { date: dueDate, accountId: 'checking-account' } : undefined,
      });

    const dues = upcomingDues(
      [
        bill('later', '2026-12-01'),
        bill('paid', '2026-11-01', true),
        bill('late', '2026-10-30'),
        bill('soon', '2026-11-05'),
      ],
      '2026-11-03',
      2,
    );

    expect(dues.map((item) => item.key)).toEqual(['bill:late', 'bill:soon']);
  });
});
