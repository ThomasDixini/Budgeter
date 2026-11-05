namespace Budgeter.Api.Domain.Finances;

/// <summary>A bank account or credit card that transactions are paid from or received into.</summary>
public sealed class Account
{
    public const int MaxNameLength = 40;

    public string Id { get; }
    public string Name { get; }
    public AccountKind Kind { get; }

    /// <summary>
    /// What a bank account held before the transactions recorded on it (negative when overdrawn);
    /// always zero on a credit card, whose balance comes from its purchases and payments only.
    /// </summary>
    public long OpeningBalanceCents { get; }

    /// <summary>How a credit card bills; null on a bank account.</summary>
    public CardTerms? Card { get; }

    private Account(string id, string name, AccountKind kind, long openingBalanceCents, CardTerms? card)
    {
        Id = id;
        Name = name;
        Kind = kind;
        OpeningBalanceCents = openingBalanceCents;
        Card = card;
    }

    /// <summary>
    /// Builds a valid account, trimming the name: a bank account takes an opening balance and no card
    /// terms, a credit card takes card terms and no opening balance.
    /// </summary>
    /// <example><code>Account.Create("nubank", "Nubank", AccountKind.BankAccount, 842035, card: null).Name; // "Nubank"</code></example>
    public static Account Create(string id, string name, AccountKind kind, long openingBalanceCents, CardTerms? card)
    {
        return new Account(
            EntityId.Require(id, "account id"),
            RequiredText.Require(name, MaxNameLength, "account name"),
            kind,
            RequireOpeningBalance(kind, openingBalanceCents),
            RequireCardTerms(kind, card));
    }

    /// <summary>
    /// Builds a valid bank account.
    /// </summary>
    /// <example><code>Account.CreateBankAccount("nubank", "Nubank", openingBalanceCents: 842035);</code></example>
    public static Account CreateBankAccount(string id, string name, long openingBalanceCents = 0) =>
        Create(id, name, AccountKind.BankAccount, openingBalanceCents, card: null);

    /// <summary>
    /// Builds a valid credit card.
    /// </summary>
    /// <example><code>Account.CreateCreditCard("visa", "Visa", CardTerms.Create(500000, 3, 10));</code></example>
    public static Account CreateCreditCard(string id, string name, CardTerms card) =>
        Create(id, name, AccountKind.CreditCard, openingBalanceCents: 0, card);

    /// <summary>
    /// Rebuilds a stored account as it was saved, without today's rules.
    /// </summary>
    /// <example><code>Account.Restore("nubank", "Nubank", AccountKind.BankAccount, 0, card: null);</code></example>
    internal static Account Restore(string id, string name, AccountKind kind, long openingBalanceCents, CardTerms? card) =>
        new(id, name, kind, openingBalanceCents, card);

    private static long RequireOpeningBalance(AccountKind kind, long openingBalanceCents)
    {
        var limit = kind == AccountKind.CreditCard ? 0 : MoneyTransaction.MaxAbsoluteAmountCents;
        if (Math.Abs(openingBalanceCents) <= limit) return openingBalanceCents;
        throw new DomainRuleException(
            $"Expected the opening balance of a {kind} to be a number of cents from -{limit} to {limit}, received {openingBalanceCents}");
    }

    private static CardTerms? RequireCardTerms(AccountKind kind, CardTerms? card)
    {
        var isCreditCard = kind == AccountKind.CreditCard;
        if (isCreditCard == card is not null) return card;
        var expected = isCreditCard ? "card terms (limit, closing day and due day)" : "no card terms";
        var received = card is null ? "none" : $"limit {card.LimitCents}, closing day {card.ClosingDay}, due day {card.DueDay}";
        throw new DomainRuleException($"Expected a {kind} to have {expected}, received {received}");
    }
}
