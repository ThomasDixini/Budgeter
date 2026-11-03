import { accountKindLabel, isCategoryNameTaken, namesById } from './finance-references';

describe('isCategoryNameTaken', () => {
  const categories = [{ id: 'food', name: 'Food' }];

  it('matches another category ignoring case and surrounding spaces', () => {
    expect(isCategoryNameTaken(categories, ' FOOD ')).toBe(true);
  });

  it('lets a category keep its own name', () => {
    expect(isCategoryNameTaken(categories, 'Food', 'food')).toBe(false);
  });
});

describe('namesById', () => {
  it('maps each id to its name', () => {
    expect(namesById([{ id: 'food', name: 'Food' }]).get('food')).toBe('Food');
  });
});

describe('accountKindLabel', () => {
  it('spells out each kind', () => {
    expect([accountKindLabel('bankAccount'), accountKindLabel('creditCard')]).toEqual([
      'Bank account',
      'Credit card',
    ]);
  });
});
