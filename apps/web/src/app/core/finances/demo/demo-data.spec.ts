import { buildDemoData, DEMO_CARD, DEMO_CHECKING, priceOnDay } from './demo-data';
import { portfolioAt } from './demo-portfolio';
import { statementsAt } from './demo-statements';

const TODAY = '2026-11-04';

describe('buildDemoData', () => {
  const data = buildDemoData(TODAY, 'en-US');

  it('gives the same data for the same day and language', () => {
    expect(buildDemoData(TODAY, 'en-US')).toEqual(data);
  });

  it('describes things in the language asked for', () => {
    expect([
      data.transactions.some((item) => item.description === 'Salary'),
      buildDemoData(TODAY, 'pt-BR').transactions.some((item) => item.description === 'Salário'),
    ]).toEqual([true, true]);
  });

  it('only holds what already happened, with ids that are not repeated and amounts that are not zero', () => {
    const ids = [...data.transactions, ...data.payments, ...data.trades, ...data.incomes].map(
      (item) => item.id,
    );

    expect([
      data.transactions.every((item) => item.date <= TODAY && item.amountCents !== 0),
      new Set(ids).size === ids.length,
      data.trades.every((item) => item.date <= TODAY),
    ]).toEqual([true, true, true]);
  });

  it('refers only to categories and accounts it has', () => {
    const categories = new Set(data.categories.map((item) => item.id));
    const accounts = new Set(data.accounts.map((item) => item.id));

    expect([
      data.transactions.every(
        (item) => categories.has(item.categoryId) && accounts.has(item.accountId),
      ),
      data.bills.every((item) => categories.has(item.categoryId)),
      data.split.parts.every((part) => part.categoryIds.every((id) => categories.has(id))),
    ]).toEqual([true, true, true]);
  });

  it('keeps the checking account above zero and the card within its limit', () => {
    const [checking, , card] = statementsAt(data.accounts, data.transactions, data.payments, TODAY);

    expect([
      checking.balanceCents > 0,
      (card.card?.availableLimitCents ?? 0) > 0,
      card.card?.openInvoice.amountCents ?? 0,
    ]).toEqual([true, true, expect.any(Number)]);
    expect(card.card?.closedInvoice.amountCents).toBeGreaterThan(0);
  });

  it('pays the invoices that have fallen due and none that has not', () => {
    const dates = data.payments.map((payment) => payment.date);

    expect([
      dates.length > 10,
      dates.every((date) => date <= TODAY),
      data.payments.every(
        (payment) => payment.fromAccountId === DEMO_CHECKING && payment.cardId === DEMO_CARD,
      ),
    ]).toEqual([true, true, true]);
  });

  it('has bills to pay and to receive, one overdue, and the paid ones settled on their day', () => {
    const open = data.bills.filter((bill) => bill.settlement === undefined);

    expect([
      open.some((bill) => bill.dueDate < TODAY),
      open.some((bill) => bill.kind === 'receivable' && bill.dueDate >= TODAY),
      data.bills
        .filter((bill) => bill.settlement !== undefined)
        .every((bill) => bill.settlement?.date === bill.dueDate),
    ]).toEqual([true, true, true]);
  });

  it('plans a split that adds up to the whole income', () => {
    expect(data.split.parts.reduce((total, part) => total + part.percent, 0)).toBe(100);
  });

  it('builds a priced portfolio with a history and yields', () => {
    const portfolio = portfolioAt({
      investments: data.investments,
      trades: data.trades,
      incomes: data.incomes,
      priceOn: (id, day) => priceOnDay(data, id, day),
      asOf: TODAY,
    });

    expect([
      portfolio.lines.every((line) => line.valueCents !== undefined),
      portfolio.totals.valueCents > 0,
      portfolio.totals.incomeCents > 0,
      (portfolio.history ?? []).length > 6,
      data.trades.some((trade) => trade.kind === 'sell'),
    ]).toEqual([true, true, true, true, true]);
  });

  it('knows the price of an investment on a day, and none for a stranger', () => {
    expect([
      (priceOnDay(data, 'demo-petr4', TODAY) ?? 0) > 0,
      priceOnDay(data, 'nobody', TODAY),
    ]).toEqual([true, undefined]);
  });
});
