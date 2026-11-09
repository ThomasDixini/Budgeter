namespace Orbit.Api.Domain.Finances;

/// <summary>
/// Money moved from a bank account to a credit card to pay its invoice. It is neither income nor an
/// expense: the purchases on the card already counted as expenses, so the payment only moves money from
/// one account to another.
/// </summary>
public sealed class CardPayment
{
    public string Id { get; }
    public string CardId { get; }
    public string FromAccountId { get; }
    public DateOnly Date { get; }

    /// <summary>The amount paid, in cents; always above zero.</summary>
    public long AmountCents { get; }

    private CardPayment(string id, string cardId, string fromAccountId, DateOnly date, long amountCents)
    {
        Id = id;
        CardId = cardId;
        FromAccountId = fromAccountId;
        Date = date;
        AmountCents = amountCents;
    }

    /// <summary>
    /// Builds a valid payment: to a credit card, from a bank account, of an amount above zero within the
    /// amount limit.
    /// </summary>
    /// <example><code>CardPayment.Create("p1", visa, checking, new DateOnly(2026, 11, 10), 234690).CardId; // "visa"</code></example>
    public static CardPayment Create(string id, Account card, Account fromAccount, DateOnly date, long amountCents)
    {
        return new CardPayment(
            EntityId.Require(id, "card payment id"),
            RequireKind(card, AccountKind.CreditCard, "card"),
            RequireKind(fromAccount, AccountKind.BankAccount, "account it is paid from"),
            date,
            RequireAmount(amountCents));
    }

    /// <summary>
    /// Rebuilds a stored payment as it was saved, without today's rules.
    /// </summary>
    /// <example><code>CardPayment.Restore("p1", "visa", "checking-account", new DateOnly(2026, 11, 10), 234690);</code></example>
    internal static CardPayment Restore(string id, string cardId, string fromAccountId, DateOnly date, long amountCents) =>
        new(id, cardId, fromAccountId, date, amountCents);

    private static string RequireKind(Account account, AccountKind expected, string role)
    {
        if (account.Kind == expected) return account.Id;
        throw new DomainRuleException(
            $"Expected the {role} of a card payment to be a {expected}, received {account.Kind} {ReceivedValue.Quote(account.Id)}");
    }

    private static long RequireAmount(long amountCents)
    {
        if (amountCents > 0 && amountCents <= MoneyTransaction.MaxAbsoluteAmountCents) return amountCents;
        throw new DomainRuleException(
            $"Expected the card payment amount to be a number of cents from 1 to {MoneyTransaction.MaxAbsoluteAmountCents}, received {amountCents}");
    }
}
