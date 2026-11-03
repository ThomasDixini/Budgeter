import { namesById } from './finance-references';

describe('namesById', () => {
  it('maps each id to its name', () => {
    expect(namesById([{ id: 'food', name: 'Food' }]).get('food')).toBe('Food');
  });
});
