import { suggestedPaymentCents } from './account-statement';
import { SAMPLE_STATEMENTS } from './fake-account-statements-gateway';

const CARD = SAMPLE_STATEMENTS[1].card!;

describe('suggestedPaymentCents', () => {
  it('offers what is still due from closed invoices first', () => {
    expect(suggestedPaymentCents({ ...CARD, amountDueCents: 41250 })).toBe(41250);
  });

  it('offers the open invoice when nothing is due', () => {
    expect(suggestedPaymentCents(CARD)).toBe(28640);
  });

  it('offers nothing when the open invoice holds only refunds', () => {
    const refunded = { ...CARD, openInvoice: { ...CARD.openInvoice, amountCents: -500 } };

    expect(suggestedPaymentCents(refunded)).toBe(0);
  });
});
