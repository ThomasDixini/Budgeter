import { SAMPLE_OCTOBER } from './fake-finances-gateways';
import { Transaction } from './transaction';
import { groupByDay } from './transaction-days';

const STREAMING: Transaction = {
  id: 'streaming',
  date: '2026-10-31',
  description: 'Streaming',
  categoryId: 'food',
  accountId: 'credit-card',
  amountCents: -5590,
};

describe('groupByDay', () => {
  it('puts the newest day first', () => {
    expect(groupByDay([...SAMPLE_OCTOBER].reverse()).map((day) => day.date)).toEqual([
      '2026-10-31',
      '2026-10-27',
      '2026-10-05',
    ]);
  });

  it('keeps the order within a day and adds up its total', () => {
    const [lastDay] = groupByDay([STREAMING, ...SAMPLE_OCTOBER]);

    expect([lastDay.transactions.map((item) => item.id), lastDay.totalCents]).toEqual([
      ['streaming', 'groceries'],
      -34230,
    ]);
  });

  it('has no days without transactions', () => {
    expect(groupByDay([])).toEqual([]);
  });
});
