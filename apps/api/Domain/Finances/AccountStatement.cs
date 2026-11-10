namespace Orbit.Api.Domain.Finances;

/// <summary>One invoice of a credit card and what was spent on it (purchases minus refunds), in cents.</summary>
public sealed record InvoiceStatement(InvoiceCycle Cycle, long AmountCents);

/// <summary>
/// Sums read for one credit card up to a day, signed as transactions are stored (purchases negative,
/// refunds positive): those of its open invoice so far, of its last closed invoice, of every purchase
/// ever made on it, and what was paid to it.
/// </summary>
public sealed record CardSums(long OpenInvoiceCents, long ClosedInvoiceCents, long AllTransactionsCents, long PaidCents);

/// <summary>
/// Where a credit card stands: the limit left to spend, what is still owed from invoices already closed,
/// and its open and last closed invoices.
/// </summary>
public sealed record CardStatement(
    long AvailableLimitCents, long AmountDueCents, InvoiceStatement OpenInvoice, InvoiceStatement ClosedInvoice)
{
    /// <summary>
    /// Works out the statement from the card's sums. Payments settle the oldest debt first, so whatever is
    /// owed beyond the open invoice is due from the closed ones.
    /// </summary>
    /// <example><code>CardStatement.From(terms, terms.CycleContaining(today), sums).AmountDueCents;</code></example>
    public static CardStatement From(CardTerms terms, InvoiceCycle openCycle, CardSums sums)
    {
        var owed = OwedCents(sums);
        var open = new InvoiceStatement(openCycle, -sums.OpenInvoiceCents);
        var closed = new InvoiceStatement(terms.CycleBefore(openCycle), -sums.ClosedInvoiceCents);
        return new CardStatement(terms.LimitCents - owed, Math.Max(0, owed - open.AmountCents), open, closed);
    }

    /// <summary>
    /// What is owed on the card: every purchase minus refunds and payments (negative when paid ahead).
    /// </summary>
    /// <example><code>CardStatement.OwedCents(new CardSums(0, 0, AllTransactionsCents: -30000, PaidCents: 10000)); // 20000</code></example>
    public static long OwedCents(CardSums sums) => -sums.AllTransactionsCents - sums.PaidCents;
}

/// <summary>
/// Where an account stands on a day. A bank account's balance is what it holds; a credit card's is minus
/// what is owed on it, and its card statement tells the invoices apart.
/// </summary>
public sealed record AccountStatement(string AccountId, long BalanceCents, CardStatement? Card)
{
    /// <summary>
    /// A bank account holds its opening balance plus its transactions, minus the card invoices paid from it.
    /// </summary>
    /// <example><code>AccountStatement.ForBankAccount(checking, transactionsCents: 540000, paidOutCents: 234690).BalanceCents;</code></example>
    public static AccountStatement ForBankAccount(Account account, long transactionsCents, long paidOutCents) =>
        new(account.Id, account.OpeningBalanceCents + transactionsCents - paidOutCents, Card: null);

    /// <summary>
    /// A credit card's balance and invoices, from its sums up to the day.
    /// </summary>
    /// <example><code>AccountStatement.ForCreditCard(visa, terms, terms.CycleContaining(today), sums);</code></example>
    public static AccountStatement ForCreditCard(Account card, CardTerms terms, InvoiceCycle openCycle, CardSums sums) =>
        new(card.Id, -CardStatement.OwedCents(sums), CardStatement.From(terms, openCycle, sums));
}
