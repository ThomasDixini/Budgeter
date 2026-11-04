import { AccountStatement, CardPayment, CardStatement, Invoice } from '../account-statement';
import { Account, CardTerms } from '../finance-references';
import { Transaction } from '../transaction';
import { addDays, addMonths, dayOfMonth } from './demo-dates';

type Cycle = Omit<Invoice, 'amountCents'>;

/**
 * The invoice a purchase made on a day goes to, for a card that closes on `terms.closingDay`: a purchase made
 * on the closing day already goes to the next invoice, and the invoice is due on `terms.dueDay` of the month
 * it closes in (the next one when that day is not after the closing day).
 * @example invoiceCycleOf('2026-10-20', { limitCents: 500000, closingDay: 3, dueDay: 10 }).closesOn // '2026-11-03'
 */
export function invoiceCycleOf(day: string, terms: CardTerms): Cycle {
  const closesThisMonth = dayOfMonth(day.slice(0, 7), terms.closingDay);
  const isBefore = day < closesThisMonth;
  const closesOn = isBefore ? closesThisMonth : dayOfMonth(addMonths(day, 1), terms.closingDay);
  const startsOn = isBefore ? dayOfMonth(addMonths(day, -1), terms.closingDay) : closesThisMonth;
  const dueMonth = terms.dueDay > terms.closingDay ? closesOn.slice(0, 7) : addMonths(closesOn, 1);
  return { startsOn, closesOn, dueOn: dayOfMonth(dueMonth, terms.dueDay) };
}

/**
 * Where every account stands on a day: a bank account holds its opening balance plus what came in and went
 * out, minus what it paid to cards; a card owes its purchases minus its payments, split between the invoice
 * still open and the ones already closed.
 * @example statementsAt(accounts, transactions, payments, '2026-11-03')[0].balanceCents
 */
export function statementsAt(
  accounts: readonly Account[],
  transactions: readonly Transaction[],
  payments: readonly CardPayment[],
  asOf: string,
): AccountStatement[] {
  const happened = transactions.filter((transaction) => transaction.date <= asOf);
  const paid = payments.filter((payment) => payment.date <= asOf);
  return accounts.map((account) => {
    const own = happened.filter((transaction) => transaction.accountId === account.id);
    const sum = own.reduce((total, transaction) => total + transaction.amountCents, 0);
    if (account.card === undefined) {
      const out = totalOf(paid.filter((payment) => payment.fromAccountId === account.id));
      return { accountId: account.id, balanceCents: account.openingBalanceCents + sum - out };
    }
    const balanceCents = sum + totalOf(paid.filter((payment) => payment.cardId === account.id));
    return {
      accountId: account.id,
      balanceCents,
      card: cardStatement(account.card, own, balanceCents, asOf),
    };
  });
}

function totalOf(payments: readonly CardPayment[]): number {
  return payments.reduce((total, payment) => total + payment.amountCents, 0);
}

function cardStatement(
  terms: CardTerms,
  own: readonly Transaction[],
  balanceCents: number,
  asOf: string,
): CardStatement {
  const open = invoiceCycleOf(asOf, terms);
  const closed = invoiceCycleOf(addDays(open.startsOn, -1), terms);
  const spentOn = (cycle: Cycle): number =>
    -own
      .filter(
        (transaction) => transaction.date >= cycle.startsOn && transaction.date < cycle.closesOn,
      )
      .reduce((total, transaction) => total + transaction.amountCents, 0);
  const owed = Math.max(0, -balanceCents);
  const openAmount = Math.max(0, spentOn(open));
  return {
    availableLimitCents: terms.limitCents - owed,
    amountDueCents: Math.max(0, owed - openAmount),
    openInvoice: { ...open, amountCents: openAmount },
    closedInvoice: { ...closed, amountCents: Math.max(0, spentOn(closed)) },
  };
}
