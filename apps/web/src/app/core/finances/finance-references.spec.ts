import { accountKindLabel, namesById } from './finance-references';

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
