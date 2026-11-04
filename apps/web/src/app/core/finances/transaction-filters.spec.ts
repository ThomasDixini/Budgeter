import { SAMPLE_FINANCE_CATEGORIES, SAMPLE_OCTOBER } from './fake-finances-gateways';
import { namesById } from './finance-references';
import { NO_FILTERS, filterTransactions, searchKey } from './transaction-filters';

const CATEGORY_NAMES = namesById(SAMPLE_FINANCE_CATEGORIES);

function idsFor(filters: Partial<typeof NO_FILTERS>): string[] {
  return filterTransactions(SAMPLE_OCTOBER, { ...NO_FILTERS, ...filters }, CATEGORY_NAMES).map(
    (transaction) => transaction.id,
  );
}

describe('filterTransactions', () => {
  it('keeps every transaction without filters, in order', () => {
    expect(idsFor({})).toEqual(['groceries', 'pharmacy', 'salary']);
  });

  it('keeps only income or only expenses', () => {
    expect([idsFor({ type: 'income' }), idsFor({ type: 'expense' })]).toEqual([
      ['salary'],
      ['groceries', 'pharmacy'],
    ]);
  });

  it('keeps one account', () => {
    expect(idsFor({ accountId: 'credit-card' })).toEqual(['groceries']);
  });

  it('finds the description without minding accents or case', () => {
    expect(idsFor({ query: '  FARMACIA ' })).toEqual(['pharmacy']);
  });

  it('finds the category name', () => {
    expect(idsFor({ query: 'food' })).toEqual(['groceries']);
  });

  it('combines the filters', () => {
    expect(idsFor({ type: 'income', accountId: 'credit-card' })).toEqual([]);
  });
});

describe('searchKey', () => {
  it('drops accents and case', () => {
    expect(searchKey('Pão de Açúcar')).toBe('pao de acucar');
  });
});
