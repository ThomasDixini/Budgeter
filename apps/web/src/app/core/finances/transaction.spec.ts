import { signedCents, typeOf } from './transaction';

describe('typeOf', () => {
  it('tells income from expense by the sign', () => {
    expect([typeOf({ amountCents: 950000 }), typeOf({ amountCents: -28640 })]).toEqual([
      'income',
      'expense',
    ]);
  });
});

describe('signedCents', () => {
  it('makes an expense negative and keeps income positive', () => {
    expect([signedCents(28640, 'expense'), signedCents(28640, 'income')]).toEqual([-28640, 28640]);
  });
});
