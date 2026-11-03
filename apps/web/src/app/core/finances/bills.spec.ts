import {
  AgendaItem,
  Bill,
  billItem,
  daysBetween,
  dueLabel,
  dueTotals,
  groupAgenda,
  invoiceItem,
  isValidRepeatCount,
  seriesLabel,
} from './bills';

const TODAY = '2026-11-03';

function bill(id: string, dueDate: string, extra: Partial<Bill> = {}): AgendaItem {
  return billItem({
    id,
    kind: 'payable',
    description: id,
    categoryId: 'food',
    amountCents: 10000,
    dueDate,
    ...extra,
  });
}

describe('daysBetween', () => {
  it('counts whole days, negative going back', () => {
    expect([daysBetween(TODAY, '2026-11-10'), daysBetween(TODAY, '2026-10-31')]).toEqual([7, -3]);
  });

  it('is not thrown off by a daylight saving change in between', () => {
    expect(daysBetween('2026-10-01', '2026-11-30')).toBe(60);
  });
});

describe('groupAgenda', () => {
  it('splits open items into overdue, the next 7 days and later, each by due date', () => {
    const items = [
      bill('later', '2026-11-10'),
      bill('today', '2026-11-03'),
      bill('last-soon', '2026-11-09'),
      bill('overdue-b', '2026-11-02'),
      bill('overdue-a', '2026-10-20'),
    ];

    const groups = groupAgenda(items, TODAY);

    expect([groups.overdue, groups.soon, groups.later].map((g) => g.map((i) => i.key))).toEqual([
      ['bill:overdue-a', 'bill:overdue-b'],
      ['bill:today', 'bill:last-soon'],
      ['bill:later'],
    ]);
  });

  it('keeps settled bills apart, the latest settlement first', () => {
    const settle = (date: string) => ({ settlement: { date, accountId: 'checking-account' } });
    const items = [
      bill('first', '2026-10-01', settle('2026-10-02')),
      bill('second', '2026-10-01', settle('2026-10-20')),
      bill('open', '2026-11-04'),
    ];

    const groups = groupAgenda(items, TODAY);

    expect([groups.settled.map((i) => i.key), groups.soon.map((i) => i.key)]).toEqual([
      ['bill:second', 'bill:first'],
      ['bill:open'],
    ]);
  });

  it('puts a card invoice among the bills by its due date', () => {
    const invoice = invoiceItem(
      { cardId: 'visa', dueOn: '2026-11-10', amountCents: 28640, isClosed: true },
      'Visa',
    );

    expect(groupAgenda([invoice], TODAY).later.map((i) => i.description)).toEqual(['Visa invoice']);
  });
});

describe('dueTotals', () => {
  it('adds what is to pay and what is to receive apart', () => {
    const items = [
      bill('rent', TODAY),
      bill('job', TODAY, { kind: 'receivable', amountCents: 5000 }),
      bill('gym', TODAY),
    ];

    expect(dueTotals(items)).toEqual({ payableCents: 20000, receivableCents: 5000 });
  });
});

describe('dueLabel', () => {
  it.each([
    ['2026-10-31', 'Overdue by 3 days'],
    ['2026-11-02', 'Overdue by 1 day'],
    ['2026-11-03', 'Due today'],
    ['2026-11-04', 'Due tomorrow'],
    ['2026-11-10', 'Due in 7 days'],
  ])('says %s is "%s"', (dueDate, label) => {
    expect(dueLabel(dueDate, TODAY)).toBe(label);
  });
});

describe('seriesLabel', () => {
  it('names installments and repeats with their place in the series', () => {
    const series = (recurrence: 'monthly' | 'yearly' | 'installments') => ({
      seriesId: 'a',
      recurrence,
      number: 2,
      count: 6,
    });

    expect([
      seriesLabel(series('installments')),
      seriesLabel(series('monthly')),
      seriesLabel(series('yearly')),
      seriesLabel(undefined),
    ]).toEqual(['Installment 2/6', 'Monthly 2/6', 'Yearly 2/6', undefined]);
  });
});

describe('isValidRepeatCount', () => {
  it.each([
    [1, false],
    [2, true],
    [60, true],
    [61, false],
    [2.5, false],
  ])('%s is %s', (count, expected) => {
    expect(isValidRepeatCount(count)).toBe(expected);
  });
});
